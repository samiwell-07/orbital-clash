import * as THREE from 'three';

/** Procedural PMREM environment (dark gradient + a few bright "stars") so metals have something to reflect. */
export function createEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vP; void main(){ float t = smoothstep(-0.6,0.9,vP.y); vec3 c = mix(vec3(0.02,0.02,0.05), vec3(0.28,0.34,0.6), t); c += vec3(0.5,0.35,0.25) * pow(max(0.0, dot(vP, normalize(vec3(-0.6,0.7,-0.5)))), 6.0); gl_FragColor = vec4(c,1.0); }',
    }),
  );
  env.add(sky);
  const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6.4, 7) });
  const starGeo = new THREE.SphereGeometry(1.6, 8, 6);
  const spots: [number, number, number][] = [[-30, 30, -20], [25, 35, 10], [5, 40, -30], [-10, 25, 30], [32, 18, -25]];
  for (const [x, y, z] of spots) {
    const s = new THREE.Mesh(starGeo, starMat);
    s.position.set(x, y, z);
    env.add(s);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.04);
  pmrem.dispose();
  sky.geometry.dispose();
  (sky.material as THREE.Material).dispose();
  starGeo.dispose();
  starMat.dispose();
  return rt.texture;
}
