# WebGPU bundle

three.webgpu.js, three.tsl.js and addons/transpiler are vendored from Three.js
0.180.0 under the adjacent MIT LICENSE. They share the existing three.core.js.

TranspilerUtils.js anchors isType's regular expression so identifiers containing
`int` (such as tint and pointSize) are not mistaken for GLSL type declarations.
The game's MaterialEncoder supplies mutable local variables, preserves out/inout
arguments, and marks inline void helpers for TSL's statement execution.
