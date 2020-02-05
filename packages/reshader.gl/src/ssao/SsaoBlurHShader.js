import QuadShader from '../shader/QuadShader.js';
import vert from '../shader/glsl/quad.vert';
import frag from './glsl/ssao_blur_h.frag';

class SsaoBlurHShader extends QuadShader {
    constructor() {
        super({
            vert, frag,
            uniforms : [
                'TextureBlurInput',
                'uTextureBlurInputRatio',
                'uTextureBlurInputSize',
                'uTextureOutputRatio',
                'uTextureOutputSize'
            ],
            extraCommandProps: {
                viewport: {
                    x: 0,
                    y: 0,
                    width: (context, props) => {
                        return props['uTextureOutputSize'][0];
                    },
                    height: (context, props) => {
                        return props['uTextureOutputSize'][1];
                    }
                }
            }
        });
    }

    getMeshCommand(regl, mesh) {
        if (!this.commands['ssao_blurh']) {
            this.commands['ssao_blurh'] = this.createREGLCommand(
                regl,
                null,
                ['aPosition', 'aTexCoord'],
                null,
                mesh.getElements()
            );
        }
        return this.commands['ssao_blurh'];
    }
}

export default SsaoBlurHShader;