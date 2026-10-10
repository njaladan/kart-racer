import { InstancedInterleavedBuffer } from "../../vendor/three/three.core.js";
import * as GPU from "../../vendor/three/three.webgpu.js";
import * as TSL from "../../vendor/three/three.tsl.js";
import GLSLDecoder from "../../vendor/three/addons/transpiler/GLSLDecoder.js";
import TSLEncoder from "../../vendor/three/addons/transpiler/TSLEncoder.js";
import Transpiler from "../../vendor/three/addons/transpiler/Transpiler.js";

// Authoring expressions are decoded to TSL nodes. No GLSL shader is submitted to
// the GPU: WebGPURenderer builds and validates WGSL from these graphs.
const factories = new Map();

class MaterialEncoder extends TSLEncoder {
  emitFunction(node) {
    for (const param of node.params)
      if (["out", "inout"].includes(param.qualifier)) param.linker.assignments = [];
    const code = super.emitFunction(node);
    return node.type === "void" ? code.replace("} );", "}, 'void' );") : code;
  }
  emitVariables(node, isRoot = true) {
    this.addImport(node.type);
    const value = node.value ? this.emitExpression(node.value) : "";
    let code = `${isRoot ? "const " : ""}${node.name} = ${node.type}(${value}).toVar()`;
    if (node.next) code += `, ${this.emitVariables(node.next, false)}`;
    return code;
  }
}

export function preprocessShader(source, defines = {}) {
  const stack = [];
  let active = true;
  return source
    .split("\n")
    .filter((line) => {
      const directive = line.trim().match(/^#(ifdef|ifndef|if|else|elif|endif|define)\b\s*(.*)/);
      if (!directive) return active;
      const [, kind, condition] = directive;
      if (kind === "ifdef" || kind === "ifndef" || kind === "if") {
        const name = condition.replace(/^defined\s*\(\s*(\w+)\s*\)$/, "$1");
        const test = !!defines[name];
        stack.push({ parent: active, test: kind === "ifndef" ? !test : test });
        active = active && stack.at(-1).test;
      } else if (kind === "else") {
        const state = stack.at(-1);
        active = state.parent && !state.test;
      } else if (kind === "elif") {
        const state = stack.at(-1);
        active = state.parent && !state.test && !!defines[condition];
        state.test ||= active;
      } else if (kind === "endif") {
        active = stack.pop().parent;
      } else if (active) {
        const [name, value] = condition.split(/\s+/, 2);
        defines[name] = value ?? true;
      }
      return false;
    })
    .join("\n");
}

function declarations(source, qualifier, callback) {
  return source.replace(new RegExp(`\\b${qualifier}\\s+(\\w+)\\s+([^;]+);`, "g"), (_, type, list) =>
    list
      .split(",")
      .map((entry) => callback(type, entry.trim()))
      .join("\n"),
  );
}

export function shaderGraph(source, uniforms, bindings = {}, varyings = {}, defines = {}) {
  source = preprocessShader(source, { ...defines });
  source = source.replace(/#include\s+<[^>]+>/g, "");
  source = declarations(source, "attribute", (type, name) => {
    bindings[name] = bindings[name] || TSL.attribute(name, type);
    return "";
  });
  source = declarations(source, "varying", (type, name) => {
    bindings[name] = varyings[name] ||= TSL.varying(TSL[type](), name);
    return "";
  });
  source = declarations(source, "uniform", (type, entry) => {
    const [, name, length] = entry.match(/^(\w+)(?:\[(\d+)\])?$/);
    if (!uniforms[name]) throw new Error(`Missing shader uniform: ${name}`);
    bindings[name] = length
      ? TSL.uniformArray(uniforms[name].value, type)
      : type.startsWith("sampler")
        ? TSL.texture(uniforms[name].value).onObjectUpdate(() => uniforms[name].value)
        : TSL.reference("value", type, uniforms[name]);
    return "";
  });
  // GLSL's two-argument atan maps to atan2 in TSL. Matrix columns use element().

  const names = Object.keys(bindings);
  const key = `${names.join(",")}\n${source}`;
  let factory = factories.get(key);
  if (!factory) {
    const encoder = new MaterialEncoder();
    encoder.iife = true;
    const decoder = new GLSLDecoder();
    const ast = decoder.parse(source);
    // Inline entry points can capture attributes, uniforms and native properties.
    for (const statement of ast.body) if (statement.isFunctionDeclaration) statement.layout = false;
    const transpiler = new Transpiler(decoder, encoder);
    transpiler.linker.process(ast);
    let code = encoder.emit(ast);
    code = code.replace(
      /const \{ ([^}]+) \} = TSL;/,
      (_, list) =>
        `const { ${list
          .split(", ")
          .filter((name) => !names.includes(name))
          .join(", ")} } = TSL;`,
    );
    code = code.replace(
      "( function ( TSL, uniforms ) {",
      `( function ( TSL, uniforms, bindings ) {\nconst { ${names.join(", ")} } = bindings;`,
    );
    try {
      factory = new Function(`return (${code.replace(/;\s*$/, "")})`)();
    } catch (error) {
      console.error("Procedural shader translation failed", source);
      throw error;
    }
    factories.set(key, factory);
  }
  return factory(TSL, uniforms, bindings).main();
}

const instanceMatrices = new WeakMap();
function instanceMatrixNode(attribute) {
  if (!attribute)
    return TSL.mat4(
      TSL.vec4(1, 0, 0, 0),
      TSL.vec4(0, 1, 0, 0),
      TSL.vec4(0, 0, 1, 0),
      TSL.vec4(0, 0, 0, 1),
    );
  if (!instanceMatrices.has(attribute)) {
    const buffer = new InstancedInterleavedBuffer(attribute.array, 16, 1);
    buffer.setUsage(attribute.usage);
    const columns = [0, 4, 8, 12].map((offset) =>
      TSL.instancedBufferAttribute(buffer, "vec4", 16, offset),
    );
    const matrix = TSL.mat4(...columns).onObjectUpdate(() => {
      buffer.version = attribute.version;
    });
    instanceMatrices.set(attribute, matrix);
  }
  return instanceMatrices.get(attribute);
}

function builtins(builder) {
  const geometry = builder.geometry;
  return {
    position: builder.object.isSkinnedMesh
      ? TSL.positionLocal
      : geometry.hasAttribute("pointPosition")
        ? TSL.attribute("pointPosition", "vec3")
        : TSL.positionGeometry,
    portQuadPosition: TSL.positionGeometry,
    portViewport: TSL.viewportSize,
    portDPR: TSL.screenDPR,
    uv: geometry.hasAttribute("uv") ? TSL.uv() : TSL.vec2(),
    normal: builder.object.isSkinnedMesh ? TSL.normalLocal : TSL.normalGeometry,
    modelMatrix: TSL.modelWorldMatrix,
    modelViewMatrix: TSL.modelViewMatrix,
    viewMatrix: TSL.cameraViewMatrix,
    projectionMatrix: TSL.cameraProjectionMatrix,
    normalMatrix: TSL.modelNormalMatrix,
    cameraPosition: TSL.cameraPosition,
    gl_FrontFacing: TSL.frontFacing,
    gl_PointCoord: TSL.uv(),
    gl_FragCoord: TSL.screenCoordinate,
    instanceMatrix: instanceMatrixNode(builder.object.instanceMatrix),
    batchingMatrix: TSL.mat4(),
    lightBake: geometry.hasAttribute("lightBake") ? TSL.attribute("lightBake", "vec4") : TSL.vec4(),
    instanceLightBake: geometry.hasAttribute("instanceLightBake")
      ? TSL.attribute("instanceLightBake", "vec4")
      : TSL.vec4(),
    inverse: TSL.Fn(([matrix]) => {
      const a = matrix.element(0),
        b = matrix.element(1),
        c = matrix.element(2);
      const x = TSL.cross(b, c),
        y = TSL.cross(c, a),
        z = TSL.cross(a, b);
      return TSL.transpose(TSL.mat3(x, y, z)).mul(TSL.float(1).div(TSL.dot(a, x)));
    }),
    inverseTransformDirection: TSL.Fn(([direction, matrix]) =>
      TSL.normalize(TSL.vec4(direction, 0).mul(matrix).xyz),
    ),
  };
}

function materialDefines(builder) {
  const material = builder.material;
  return {
    USE_INSTANCING: !!builder.object.isInstancedMesh,
    USE_NORMALMAP: !!material.normalMap,
    USE_NORMALMAP_TANGENTSPACE: !!material.normalMap,
    USE_COLOR: !!material.vertexColors,
    USE_FOG: false,
  };
}

export class ProceduralNodeMaterial extends GPU.NodeMaterial {
  setupPositionView() {
    return TSL.vec3(0, 0, this.portDepth.negate());
  }
  constructor() {
    super();
    this.lights = false;
  }
  setup(builder) {
    const varyings = {};
    this.portDepth = TSL.varying(TSL.float());
    const bindings = { ...builtins(builder), portShaderDepth: this.portDepth };
    const defines = materialDefines(builder);
    if (builder.geometry.hasAttribute("color")) bindings.color = TSL.attribute("color", "vec3");
    let vertex = this.vertexShader.replace(/\bvoid\s+main\s*\(\s*\)/, "vec4 main()");
    vertex = vertex.replace(/\bgl_Position\b/g, "clipPosition");
    vertex = this.userData.webgpuBillboard
      ? vertex
          .replace(/\bgl_PointSize\b/g, "portPointDiameter")
          .replace("vec4 main(){", "vec4 main(){float portPointDiameter=1.;")
          .replace(
            /}\s*$/,
            "clipPosition.xy+=portQuadPosition.xy*portPointDiameter*portDPR/portViewport*clipPosition.w;}",
          )
      : vertex.replace(/\bgl_PointSize\s*=\s*[^;]+;/g, "");
    vertex = vertex.replace(/vec4 main\(\)\s*\{/, "vec4 main(){vec4 clipPosition=vec4(0.);");
    vertex = vertex.replace(/}\s*$/, "portShaderDepth=clipPosition.w;return clipPosition;}");
    let fragment = this.fragmentShader.replace(/\bvoid\s+main\s*\(\s*\)/, "vec4 main()");
    fragment = fragment.replace(/\bgl_FragColor\b/g, "pixelColor");
    fragment = fragment.replace(/vec4 main\(\)\s*\{/, "vec4 main(){vec4 pixelColor=vec4(0.);");
    fragment = fragment.replace(/}\s*$/, "return pixelColor;}");
    this.vertexNode = shaderGraph(vertex, this.uniforms, { ...bindings }, varyings, defines);
    this.fragmentNode = shaderGraph(fragment, this.uniforms, { ...bindings }, varyings, defines);
    super.setup(builder);
  }
}

const vertexTemplate = `#include <common>
void main(){
#include <beginnormal_vertex>
#include <begin_vertex>
#include <project_vertex>
#include <worldpos_vertex>
}`;
const fragmentTemplate = `#include <common>
void main(){
#include <map_fragment>
#include <color_fragment>
#include <roughnessmap_fragment>
#include <normal_fragment_maps>
#include <lights_physical_fragment>
#include <lights_fragment_end>
//PORT_OUTPUT
#include <opaque_fragment>
}`;

const materialGraphs = new WeakMap();
const graphProperties = [
  "vertexNode",
  "colorNode",
  "normalNode",
  "roughnessNode",
  "portSpecular",
  "portContext",
  "portShader",
];
function portMaterial(Base) {
  return class extends Base {
    setup(builder) {
      const layout = `${this.type}:${builder.object.isInstancedMesh ? builder.object.uuid : "mesh"}:${Object.entries(
        builder.geometry.attributes,
      )
        .map(([name, attr]) => `${name}:${attr.itemSize}`)
        .sort()
        .join(",")}`;
      const cached = materialGraphs.get(this.onBeforeCompile)?.get(layout);
      if (cached) {
        Object.assign(this, cached);
        super.setup(builder);
        return;
      }
      const shader = {
        uniforms: {},
        vertexShader: vertexTemplate,
        fragmentShader: fragmentTemplate,
      };
      this.onBeforeCompile(shader, builder.renderer);
      if (shader.vertexShader === vertexTemplate && shader.fragmentShader === fragmentTemplate) {
        super.setup(builder);
        return;
      }
      this.portShader = shader;
      const bindings = builtins(builder),
        varyings = {},
        defines = materialDefines(builder);
      const materialUniforms = ["map", "normalMap", "roughnessMap", "normalScale", "roughness"];
      for (const name of materialUniforms) shader.uniforms[name] ||= { value: this[name] };
      const analyticNormal = shader.vertexShader.includes("stormSurface(")
        ? TSL.varying(TSL.vec3())
        : null;
      if (analyticNormal) bindings.portAnalyticNormal = analyticNormal;
      const vertex = shader.vertexShader
        .replace("#include <beginnormal_vertex>", "vec3 objectNormal=normal;")
        .replace("#include <begin_vertex>", "vec3 transformed=position;")
        .replace(
          "#include <project_vertex>",
          "vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(transformed,1.);gl_Position=projectionMatrix*mvPosition;",
        )
        .replace(/\bvoid main\(\)/, "vec4 main()")
        .replace(/\bgl_Position\b/g, "clipPosition")
        .replace("vec4 main(){", "vec4 main(){vec4 clipPosition=vec4(0.);")
        .replace(
          /}\s*$/,
          `${analyticNormal ? "portAnalyticNormal=objectNormal;" : ""}return clipPosition;}`,
        );
      this.vertexNode = shaderGraph(vertex, shader.uniforms, { ...bindings }, varyings, defines);
      const baseNormalContext = { setupNormal: () => TSL.normalViewGeometry };
      const normalBase = analyticNormal
        ? TSL.normalize(TSL.modelNormalMatrix.mul(analyticNormal))
        : this.userData.scannedSurface
          ? TSL.normalViewGeometry
          : TSL.materialNormal.context(baseNormalContext);
      const pre = shader.fragmentShader.split("#include <lights_fragment_end>")[0];
      let prefix = pre.slice(0, pre.indexOf("void main()"));
      const body = pre
        .slice(pre.indexOf("void main()") + "void main()".length)
        .replace(/^\s*\{/, "");
      for (const name of materialUniforms)
        if (!new RegExp(`uniform[^;]*\\b${name}\\b`).test(prefix)) {
          const type =
            name.endsWith("Map") || name === "map"
              ? "sampler2D"
              : name === "normalScale"
                ? "vec2"
                : "float";
          if (shader.uniforms[name].value != null) prefix += `\nuniform ${type} ${name};`;
        }
      const prelude = `vec4 diffuseColor=portColor;float roughnessFactor=portRoughness;vec3 normal=portNormal;vec3 nonPerturbedNormal=portFlatNormal;vec3 vViewPosition=-portViewPosition;vec3 specularColor=vec3(.04);`;
      let code = body
        .replace(/float roughnessFactor\s*=/g, "roughnessFactor=")
        .replace(/\bmaterial\.specularColor\b/g, "specularColor");
      code = code.replace("#include <map_fragment>", "");
      code = code.replace("#include <roughnessmap_fragment>", "");
      code = code.replace("#include <normal_fragment_maps>", "");
      const scope = {
        ...bindings,
        portColor: shader.fragmentShader.includes("#include <map_fragment>")
          ? TSL.materialColor
          : TSL.vec4(TSL.materialReference("color", "color"), TSL.materialOpacity),
        portRoughness:
          this.roughness == null
            ? TSL.float(1)
            : this.userData.scannedSurface
              ? TSL.materialReference("roughness", "float")
              : TSL.materialRoughness,
        portNormal: normalBase,
        portFlatNormal: TSL.normalViewGeometry,
        portViewPosition: TSL.positionView,
        tbn: TSL.TBNViewMatrix.context(baseNormalContext),
        vNormalMapUv: builder.geometry.hasAttribute("uv") ? TSL.uv() : TSL.vec2(),
      };
      const surface = TSL.struct({
        color: "vec4",
        normal: "vec3",
        roughness: "float",
        specular: "vec3",
      });
      const result = shaderGraph(
        `${prefix}\nvec4 main(){${prelude}\n${code}\nreturn portSurface(diffuseColor,normal,roughnessFactor,specularColor);}`,
        shader.uniforms,
        { ...scope, portSurface: surface },
        varyings,
        defines,
      ).toVar();
      this.colorNode = TSL.nodeObject(result.get("color"));
      this.normalNode = TSL.nodeObject(result.get("normal"));
      this.roughnessNode = TSL.nodeObject(result.get("roughness"));
      this.portSpecular = TSL.nodeObject(result.get("specular"));
      this.portContext = { prefix, prelude, code, scope, varyings, defines };
      if (!materialGraphs.has(this.onBeforeCompile))
        materialGraphs.set(this.onBeforeCompile, new Map());
      materialGraphs
        .get(this.onBeforeCompile)
        .set(layout, Object.fromEntries(graphProperties.map((key) => [key, this[key]])));
      super.setup(builder);
    }
    setupVariants(builder) {
      super.setupVariants(builder);
      if (this.portSpecular && this.isMeshStandardNodeMaterial)
        TSL.specularColor.mulAssign(this.portSpecular.div(0.04));
    }
    setupLighting(builder) {
      const light = super.setupLighting(builder);
      if (!this.portContext) return light;
      const { prefix, prelude, code, scope, varyings, defines } = this.portContext;
      const tail =
        this.portShader.fragmentShader
          .split("//PORT_OUTPUT")[1]
          ?.replace("#include <opaque_fragment>", "")
          .replace(/}\s*$/, "") || "";
      const source = `${prefix}\nvec3 main(){${prelude}\n${code}\nvec3 outgoingLight=portOutgoingLight;\n${tail}\nreturn outgoingLight;}`;
      return shaderGraph(
        source,
        this.portShader.uniforms,
        { ...scope, portOutgoingLight: light },
        varyings,
        defines,
      );
    }
    setupLightingModel(builder) {
      const model = super.setupLightingModel(builder);
      if (!this.portContext) return model;
      if (!model) return model;
      const indirect = model.indirect.bind(model);
      model.indirect = (context) => {
        indirect(context);
        const { prefix, prelude, code, scope, varyings, defines } = this.portContext;
        const tail =
          this.portShader.fragmentShader
            .split("#include <lights_fragment_end>")[1]
            ?.split("//PORT_OUTPUT")[0] || "";
        const body = `${prefix}\nvoid main(){${prelude}\n${code}\n${tail}}`;
        const lightScope = {
          ...scope,
          portIndirectDiffuse: context.context.reflectedLight.indirectDiffuse,
          portIndirectSpecular: context.context.reflectedLight.indirectSpecular,
        };
        shaderGraph(
          body
            .replace(/reflectedLight\.indirectDiffuse/g, "portIndirectDiffuse")
            .replace(/reflectedLight\.indirectSpecular/g, "portIndirectSpecular"),
          this.portShader.uniforms,
          lightScope,
          varyings,
          defines,
        ).toStack();
      };
      return model;
    }
  };
}

export function installWebGPUMaterials(renderer) {
  renderer.library.materialNodes.set("ShaderMaterial", ProceduralNodeMaterial);
  for (const [name, Base] of [
    ["MeshStandardMaterial", GPU.MeshStandardNodeMaterial],
    ["MeshPhysicalMaterial", GPU.MeshPhysicalNodeMaterial],
    ["MeshBasicMaterial", GPU.MeshBasicNodeMaterial],
  ]) {
    renderer.library.materialNodes.set(name, portMaterial(Base));
  }
}
