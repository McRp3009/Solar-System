const m4 = twgl.m4;
const gl = document.querySelector("canvas").getContext("webgl");
var lighting_mode = document.getElementById("shadow");
const programInfo = twgl.createProgramInfo(gl, ["vs", "fs"]);

const programInfo_phong = twgl.createProgramInfo(gl, ["vs-phong", "fs-phong"]);
const programInfo_gouraud = twgl.createProgramInfo(gl, ["vs-gouraud", "fs-gouraud"]);
const uniforms_shading = {
    u_viewInverse: m4.identity(),
    u_lightWorldPos: [0, 0, 0],
    u_lightColor: [1, 0.9, 0.9,1],
    u_ambient: [0.2, 0.2, 0.2,1],
    u_specular: [1, 1, 1, 1],
    u_shininess: 50,
    u_specularFactor: 0,
};

const programInfo_orbit = twgl.createProgramInfo(gl, ["vs-orbit", "fs-orbit"]);

var showOrbits = true
var stopped = false
var programInfos = [programInfo, programInfo_phong, programInfo_gouraud]
var currentProgramIndex = 0
var currentProgramInfo = programInfos[currentProgramIndex]

// #################################################################

class Camera {
    constructor() {
        this.fov = 30 * Math.PI / 180;
        this.aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        this.zNear = 0.5;
        this.zFar = 100000;
        this.eye = [1000,500,1000];
        this.target = [0, 0, 0];
        this.up = [0, 1, 0];
        this.view = m4.identity();
        this.projection = m4.identity();
        this.viewProjection = m4.identity();

        this.moveSpeed = 2;

        this.updateProjectionMatrix();
        this.updateViewMatrix();
    }

    updateProjectionMatrix() {
        this.projection = m4.perspective(this.fov, this.aspect, this.zNear, this.zFar);
        this.updateViewProjectionMatrix();
    }

    updateViewMatrix() {
        this.view = m4.inverse(m4.lookAt(this.eye,this.target,this.up));
        this.updateViewProjectionMatrix();
    }

    updateViewProjectionMatrix() {
        this.viewProjection = m4.multiply(this.projection, this.view);
    }

    setAspectRatio(aspect) {
        this.aspect = aspect;
        this.updateProjectionMatrix();
    }

    setEye(eye) {
        this.eye = eye
        this.updateViewMatrix();
        uniforms_shading.u_viewInverse = m4.lookAt(this.eye, this.target, this.up);
    }

    setTarget(target) {
        this.target = target.slice();
        this.updateViewMatrix();
        uniforms_shading.u_viewInverse = m4.lookAt(this.eye, this.target, this.up);

    }

    setZoom(zoom) {
        this.eye[0] = Math.max(this.eye[0]+zoom, 10);
        this.eye[1] = Math.max(this.eye[1]+zoom, 10);
        this.eye[2] = Math.max(this.eye[2]+zoom, 10);
        this.updateViewMatrix();
    }

    setUp(up) {
        this.up = up;
        this.updateViewMatrix();
        uniforms_shading.u_viewInverse = m4.lookAt(this.eye, this.target, this.up);
    }
}

function getTexture(type) {

    const texture = twgl.createTexture(gl, {
        min: gl.NEAREST,
        mag: gl.NEAREST,
        src: './textures/' + type + '.jpg',
        crossOrigin: '',
    });

    return texture;

}

// const EARTH_YEAR = 2 * Math.PI * (1/60) * (1/60);
const EARTH_SIZE = 1;
const EARTH_ORBIT_TRANSLATION = 75 + 2.5 + 0.5;
const EARTH_ORBIT_SPEED = 1/87.5;
// const ROTATION_SPEED = ;

const planetInfo = {

    //feito
    size : {
        "sun" : 15 * EARTH_SIZE,
        "moon" : 0.2724 * EARTH_SIZE,
        "mercury" : 0.3 * EARTH_SIZE,
        "venus" : 0.9 * EARTH_SIZE,
        "earth" : EARTH_SIZE,
        "mars" : 0.5 * EARTH_SIZE,
        "jupiter" : 11.21 * EARTH_SIZE,
        "saturn" : 9.45 * EARTH_SIZE,
        "uranus" : 4.01 * EARTH_SIZE,
        "neptune" : 3.88 * EARTH_SIZE,
    },

    //feito
    orbitTranslation : {
        "sun" : 0,
        "moon" : EARTH_SIZE + 0.2724 * EARTH_SIZE + 1,
        "mercury" : 0.3 * EARTH_ORBIT_TRANSLATION,
        "venus" : 0.7 * EARTH_ORBIT_TRANSLATION,
        "earth" : EARTH_ORBIT_TRANSLATION,
        "mars" : 1.5 * EARTH_ORBIT_TRANSLATION,
        "jupiter" : 5.20 * EARTH_ORBIT_TRANSLATION,
        "saturn" : 9.57 * EARTH_ORBIT_TRANSLATION,
        "uranus" : 19.17 * EARTH_ORBIT_TRANSLATION,
        "neptune" : 30.18 * EARTH_ORBIT_TRANSLATION,
    },

    //feito
    orbitSpeed : {
        "sun" : 0,
        "moon" : 0.009,
        "mercury" : 1.18 * EARTH_ORBIT_SPEED,
        "venus" : 1.59 * EARTH_ORBIT_SPEED,
        "earth" : EARTH_ORBIT_SPEED,
        "mars" : 0.8 * EARTH_ORBIT_SPEED,
        "jupiter" : 0.439 * EARTH_ORBIT_SPEED,
        "saturn" : 0.325 * EARTH_ORBIT_SPEED,
        "uranus" : 0.228 * EARTH_ORBIT_SPEED,
        "neptune" : 0.182 * EARTH_ORBIT_SPEED,
    },

    rotationTilt : {
        "sun" : 0,
        "moon" : 20 * Math.PI/180,
        "mercury" : 0,
        "venus" : 177.3 * Math.PI/180,
        "earth" : 23.4 * Math.PI/180,
        "mars" : 25.2 * Math.PI/180,
        "jupiter" : 3.1 * Math.PI/180,
        "saturn" : 26.7 * Math.PI/180,
        "uranus" : 97.8 * Math.PI/180,
        "neptune" : 28.3 * Math.PI/180,
    },

    rotationSpeed : {
        "sun" : 0.0001,
        "moon" : 0.001,
        "mercury" : 0.001,
        "venus" : 0.001,
        "earth" : 0.001,
        "mars" : 0.001,
        "jupiter" : 0.001,
        "saturn" : 0.001,
        "uranus" : 0.001,
        "neptune" : 0.001,
    }

};

class Planeta {

    constructor(type) {
        this.name = type;
        this.uniforms = {
            u_texture: getTexture(type),
            u_worldViewProjection: m4.identity(),
            u_world: m4.identity(),
            u_worldInverseTranspose: m4.identity(),
        }
        this.coords = [0,0,0]
        this.world = m4.identity();
        this.buffer = twgl.primitives.createSphereBufferInfo(gl, planetInfo.size[this.name], 64, 64);
        this.orbit = twgl.primitives.createTorusBufferInfo(gl, planetInfo.orbitTranslation[this.name], 0.001, 64, 64);
    }
    
    updateWorldViewProjection() {
        this.uniforms.u_worldViewProjection = m4.multiply(camera.viewProjection, this.world);
    }

    updateWorld() {
        this.uniforms.u_world = this.world
        this.uniforms.u_worldInverseTranspose = m4.transpose(m4.inverse(this.world));
    }
    
    setMoonWorld(planet, time) {
        var s_planet = planetInfo.orbitSpeed[planet.name];
        var t_planet = planetInfo.orbitTranslation[planet.name];
    
        var planetPos = [
            t_planet * Math.sin(time * s_planet * (2 * Math.PI / 180)),
            0,
            t_planet * Math.cos(time * s_planet * (2 * Math.PI / 180)),
        ];
        
    
        var t = planetInfo.orbitTranslation[this.name];
        var s = planetInfo.orbitSpeed[this.name];
        var r = planetInfo.rotationSpeed[this.name];
        
        var moonInclination = planetInfo.rotationTilt[this.name];
    
        var moonPos = twgl.v3.create(
            t * Math.sin(time * s * 10 * (2 * Math.PI / 180)),
            t * Math.sin(moonInclination) * Math.sin(time * s * 10 * (2 * Math.PI / 180)),
            t * Math.cos(moonInclination) * Math.cos(time * s * 10 * (2 * Math.PI / 180))
        );
    
        this.coords = twgl.v3.add(planetPos, moonPos);
    
        var moonRotationMatrix = m4.rotationX(r);
        this.world = m4.multiply(m4.translation(this.coords), moonRotationMatrix);
    
        this.updateWorld();
        this.updateWorldViewProjection();
    }
    

    setPlanetWorld(time) {
        var t = planetInfo.orbitTranslation[this.name];
        var s = planetInfo.orbitSpeed[this.name];
        var r = planetInfo.rotationSpeed[this.name];
        var tilt = planetInfo.rotationTilt[this.name];
        var rotationMatrix = m4.multiply( m4.rotationY(time*r), m4.rotationX(tilt))
        if (this.name == "mars") {
            var scaleX = 1.75
            var scaleZ = 1.25
        } else {
            var scaleX = 1
            var scaleZ = 1
        }
        this.coords = [scaleX * t*Math.sin(time * s * (2*Math.PI/180)), 0, scaleZ * t*Math.cos(time * s * (2*Math.PI/180))]

        this.world = m4.multiply(m4.translation(this.coords), rotationMatrix);

        this.updateWorld()
        this.updateWorldViewProjection();
    }

    drawOrbits() {
        var orbit_u;
    
        if (this.name === "moon") {
            var moonOrbitTilt = planetInfo.rotationTilt[this.name];
    
            var v = [earth.coords[0], 0, earth.coords[2]];
            var r = m4.multiply( m4.rotationY(-1*Math.PI/2),m4.rotationX(moonOrbitTilt));
    
            orbit_u = {
                u_color: twgl.v3.create(1, 1, 1),
                u_alpha: 1,
                u_worldViewProjection: m4.multiply(camera.viewProjection, m4.multiply(m4.translation(v), r)),
            };
        } else if (this.name == "mars") {
            orbit_u = {
                u_color: twgl.v3.create(1, 1, 1),
                u_alpha: 1,
                u_worldViewProjection: m4.multiply(camera.viewProjection, m4.scaling([1.75, 1, 1.25])),
            };
        } else {
            orbit_u = {
                u_color: twgl.v3.create(1, 1, 1),
                u_alpha: 1,
                u_worldViewProjection: m4.multiply(camera.viewProjection, m4.translation([0, 0, 0])),
            };
        }
    
        gl.useProgram(programInfo_orbit.program);
        twgl.setBuffersAndAttributes(gl, programInfo_orbit, this.orbit);
        twgl.setUniforms(programInfo_orbit, orbit_u);
        twgl.drawBufferInfo(gl, this.orbit, gl.LINES);
    }

    drawRings(time) {

        var ring = twgl.primitives.createTorusBufferInfo(gl, 10, 1.75, 64, 64);
        var ring2 = twgl.primitives.createTorusBufferInfo(gl, 15, 0.75, 64, 64);
        var ring3 = twgl.primitives.createTorusBufferInfo(gl, 20, 0.25, 64, 64);

        var w = m4.multiply(m4.rotationY(time*planetInfo.rotationSpeed["saturn"]),m4.rotationX(Math.PI/8))


        var w2 = m4.multiply(w, m4.scaling([2,0.5,2]))

        var world = m4.multiply(m4.translation(this.coords),w2);


        var ring_u_1 = {
            u_color: twgl.v3.create(0.6, 0.4, 0.2),
            u_alpha: 0.5,
            u_worldViewProjection: m4.multiply(camera.viewProjection, world),
        }

        var ring_u_2 = {
            u_color: twgl.v3.create(0.8, 0.6, 0.4),
            u_alpha: 0.5,
            u_worldViewProjection: m4.multiply(camera.viewProjection, world),
        }

        var ring_u_3 = {
            u_color: twgl.v3.create(0.6, 0.4, 0.2),
            u_alpha: 0.5,
            u_worldViewProjection: m4.multiply(camera.viewProjection, world),
        }

        gl.useProgram(programInfo_orbit.program);
        twgl.setBuffersAndAttributes(gl, programInfo_orbit, ring);
        twgl.setUniforms(programInfo_orbit, ring_u_1);
        twgl.drawBufferInfo(gl, ring, gl.LINES);
        // 
        twgl.setBuffersAndAttributes(gl, programInfo_orbit, ring2);
        twgl.setUniforms(programInfo_orbit, ring_u_2);
        twgl.drawBufferInfo(gl, ring2, gl.LINES);
        // 
        twgl.setBuffersAndAttributes(gl, programInfo_orbit, ring3);
        twgl.setUniforms(programInfo_orbit, ring_u_3);
        twgl.drawBufferInfo(gl, ring3, gl.LINES);


    }   

    draw(time) {
        
        var u = this.uniforms
        
        gl.useProgram(currentProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, currentProgramInfo, this.buffer);


        if (currentProgramIndex == 1 || currentProgramIndex == 2) {
            u = Object.assign({}, this.uniforms, uniforms_shading);
            if (this.name == "sun") {
                u.u_ambient = [1,1,1,1]
                u.u_lightColor = [1,1,1,1]
            }
        }

        twgl.setUniforms(currentProgramInfo, u);
        twgl.drawBufferInfo(gl, this.buffer);

        if (showOrbits) {
            this.drawOrbits()
        }

        if (this.name == "saturn") {
            this.drawRings(time);
        }
        
    }

}

const camera = new Camera();

const sun = new Planeta("sun");
const mercury = new Planeta("mercury");
const venus = new Planeta("venus")
const earth = new Planeta("earth")
const moon = new Planeta("moon");
const mars = new Planeta("mars");
const jupiter = new Planeta("jupiter");
const saturn = new Planeta("saturn");
const uranus = new Planeta("uranus");
const neptune = new Planeta("neptune");



function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (stopped) {
        time = 0    
    }

    sun.setPlanetWorld(time);
    mercury.setPlanetWorld(time);
    venus.setPlanetWorld(time);
    earth.setPlanetWorld(time);
    moon.setMoonWorld(earth,time);
    mars.setPlanetWorld(time);
    jupiter.setPlanetWorld(time);
    saturn.setPlanetWorld(time);
    uranus.setPlanetWorld(time);
    neptune.setPlanetWorld(time);

    sun.draw(time);
    mercury.draw(time);
    venus.draw(time);
    earth.draw(time);
    moon.draw(time);
    mars.draw(time);
    jupiter.draw(time);
    saturn.draw(time);
    uranus.draw(time);
    neptune.draw(time);

    requestAnimationFrame(render);
}

function handleWheel(event) {

    const forward = twgl.v3.normalize(twgl.v3.subtract(camera.target, camera.eye));
    
    if (event.deltaY < 0) {
        var new_eye = twgl.v3.add(camera.eye, twgl.v3.mulScalar(forward, 50))      

        if (twgl.v3.distance(new_eye, camera.target) > 30) {
            camera.setEye(new_eye)
        }

    }
    else {
        var new_eye = twgl.v3.subtract(camera.eye, twgl.v3.mulScalar(forward, 50));
        camera.setEye(new_eye);
    }
    
}

document.addEventListener('wheel', handleWheel);

function handleKeyPress(event) {
    const forward = twgl.v3.normalize(twgl.v3.subtract(camera.target, camera.eye));
    const right = twgl.v3.normalize(twgl.v3.cross(camera.up, forward));

    switch (event.key) {
        case '1':
            camera.setEye(earth.coords);
            camera.setUp([0,1,0])
            camera.setTarget([0,0,0])
            break;
        case '2':
            var array = [0,100,1]
            camera.setEye(array);
            camera.setTarget([0,0,0])
            camera.setUp([0,1,0])
            break;
        case 'ArrowUp':
            camera.setEye(twgl.v3.add(camera.eye, twgl.v3.mulScalar(camera.up, camera.moveSpeed)));
            camera.setTarget(twgl.v3.add(camera.target, twgl.v3.mulScalar(camera.up, camera.moveSpeed)));
            break;
        case 'ArrowDown':
            camera.setEye(twgl.v3.subtract(camera.eye, twgl.v3.mulScalar(camera.up, camera.moveSpeed)));
            camera.setTarget(twgl.v3.subtract(camera.target, twgl.v3.mulScalar(camera.up, camera.moveSpeed)));
            break;
        case 'ArrowLeft':
            camera.setEye(twgl.v3.add(camera.eye, twgl.v3.mulScalar(right, camera.moveSpeed)));
            camera.setTarget(twgl.v3.add(camera.target, twgl.v3.mulScalar(right, camera.moveSpeed)));
            break;
        case 'ArrowRight':
            camera.setEye(twgl.v3.subtract(camera.eye, twgl.v3.mulScalar(right, camera.moveSpeed)));
            camera.setTarget(twgl.v3.subtract(camera.target, twgl.v3.mulScalar(right, camera.moveSpeed)));
            break;
        case 'r' : 
            camera.setEye([50,25,50])
            camera.setTarget([0,0,0])
            camera.setUp([0,1,0])
            break;
        case 'R' : 
            camera.setEye([50,25,50])
            camera.setTarget([0,0,0])
            camera.setUp([0,1,0])
            break;
        case 'o' :
            showOrbits = !showOrbits;
            break;
        case 'O' :
            showOrbits = !showOrbits;
            break;
        case ' ' :
            currentProgramIndex = (currentProgramIndex+1) % programInfos.length
            currentProgramInfo = programInfos[currentProgramIndex]
            if (currentProgramIndex == 0) {
                lighting_mode.textContent = "Lighting mode: No lighting"
            } else if (currentProgramIndex == 1) {
                lighting_mode.textContent = "Lighting mode: Phong"
            } else {
                lighting_mode.textContent = "Lighting mode: Gouraud"
            }
            break;
        case 's' :
            stopped = !stopped
            break;
        case 'S' :
            stopped = !stopped
            break;
    }
}
document.addEventListener('keydown', handleKeyPress);

let isDragging = false;
let dragStartX, dragStartY;

function handleMouseDown(event) {
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
}

function handleMouseMove(event) {
    if (isDragging) {
        var deltaX = event.clientX - dragStartX;
        var deltaY = event.clientY - dragStartY;

        if (Math.abs(deltaX) > Math.abs(deltaY) + 1) {
            deltaY = 0
        }

        
        if (Math.abs(deltaY) > Math.abs(deltaX) + 1) {
            deltaX = 0
        }


        const rotateAmount = 0.007;

        const right = [camera.view[0], camera.view[4], camera.view[8]];
        const up = [camera.view[1], camera.view[5], camera.view[9]];

        twgl.v3.normalize(right, right);
        twgl.v3.normalize(up, up);

        const rotationMatrixX = m4.axisRotation(right, -deltaY * rotateAmount);

        const rotationMatrixY = m4.axisRotation(up, deltaX * rotateAmount);

        const combinedRotationMatrix = m4.multiply(rotationMatrixY, rotationMatrixX);

        const eyeToTarget = twgl.v3.subtract(camera.eye, camera.target);
        const rotatedEyeToTarget = twgl.m4.transformDirection(combinedRotationMatrix, eyeToTarget);
        const newEye = twgl.v3.add(camera.target, rotatedEyeToTarget);

        camera.setEye(newEye);
        camera.setUp(twgl.m4.transformDirection(rotationMatrixX, camera.up));

        dragStartX = event.clientX;
        dragStartY = event.clientY;
    }
}



function handleMouseUp() {
    isDragging = false;
}

document.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);

requestAnimationFrame(render);

