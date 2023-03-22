const maptalks = require('maptalks');
const { GroupGLLayer } = require('@maptalks/gl');

const { Geo3DTilesLayer } = require('../dist/maptalks.3dtiles');
const assert = require('assert');
const { match, writeImageData } = require('./util');
const startServer = require('./server.js');
const { join } = require('path');

const PORT = 4399;

const TARGET_CANVAS = document.createElement('canvas');

describe('render specs', () => {
    let server;
    before(done => {
        server = startServer(PORT, done);
    });

    after(() => {
        server.close();
    });

    let container, map;

    function createMap(center) {
        const option = {
            zoom: 20,
            center: center || [0, 0],
            // centerCross: true
            baseLayer: new maptalks.TileLayer('base', {
              urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              subdomains: ['a','b','c','d'],
              attribution: '&copy; <a href="http://osm.org">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/">CARTO</a>'
            }),
        };
        map = new maptalks.Map(container, option);
    }

    beforeEach(() => {
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        container.style.backgroundColor = '#000';
        document.body.appendChild(container);
        createMap();
    });

    afterEach(() => {
        map.remove();
        document.body.innerHTML = '';
    });

    const runner = (done, layer, expected, layerAssertion) => {
        layer.on('loadtileset', () => {
            if (expected.view) {
                map.setView(expected.view);
            } else {
                const extent = layer.getExtent(0);
                if (expected.pitch) {
                    map.setPitch(expected.pitch);
                }
                map.fitExtent(extent, expected.zoomOffset || 0, { animation: false });
            }

        });
        let ended = false;
        layer.on('canvasisdirty', ({ renderCount }) => {
            if (ended) {
                return;
            }

            const expectedPath = join(__dirname, expected.path);
            const threshold = expected.threshold || 0.1;
            if (renderCount >= expected.renderCount) {
                const canvas = layer.getRenderer().canvas;
                //比对测试
                match(canvas, expectedPath, threshold, (err, result) => {
                    if (err) {
                        console.error(err);
                        done(err);
                        return;
                    }
                    if (result.diffCount > (expected.diffCount || 0)) {
                        //保存差异图片
                        const dir = expectedPath.substring(0, expectedPath.length - 'expected.png'.length);
                        const diffPath = dir + 'diff.png';
                        writeImageData(diffPath, result.diffImage, result.width, result.height);
                        const actualPath = dir + 'actual.png';
                        TARGET_CANVAS.width = canvas.width;
                        TARGET_CANVAS.height = canvas.height;
                        const ctx = TARGET_CANVAS.getContext('2d');
                        ctx.drawImage(canvas, 0, 0);
                        writeImageData(actualPath, ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
                    }
                    ended = true;
                    assert(result.diffCount <= expected.diffCount, 'result: ' + result.diffCount + ', expected: ' + expected.diffCount);
                    if (layerAssertion) {
                        layerAssertion(layer);
                    }
                    done();
                });
            }
        });
        if (expected.noGroup) {
            layer.addTo(map);
        } else {
            const group = new GroupGLLayer('group', [layer]);
            group.addTo(map);
        }

    };

    context('Other specs', () => {

        it('i3s-eslpk-1.7-no-draco', done => {
            // 必须要放到第一个来运行测试，否则会失败，原因未知
            const resPath = 'I3S/eslpk';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                enableI3SCompressedGeometry: false,
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/3dSceneLayer.json`,
                        shader: 'phong',
                        maximumScreenSpaceError: 32,
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getB3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const geoData = mesh.geometry.data;
                assert(!!geoData['_BATCHID']);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 4, threshold: 0.4, zoomOffset: 0 }, assertion);
        }).timeout(10000);

        it('i3s-eslpk-1.7', done => {
            // 必须要放到第一个来运行测试，否则会失败，原因未知
            const resPath = 'I3S/eslpk';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/3dSceneLayer.json`,
                        shader: 'phong',
                        maximumScreenSpaceError: 32,
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getB3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const geoData = mesh.geometry.data;
                assert(!!geoData['_BATCHID']);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 4, threshold: 0.4, zoomOffset: 0 }, assertion);
        }).timeout(10000);

        it('i3s-eslpk-1.6-no-draco', done => {
            // 必须要放到第一个来运行测试，否则会失败，原因未知
            const resPath = 'I3S/eslpk';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                enableI3SCompressedGeometry: false,
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/3dSceneLayer.json`,
                        i3sVersion: '1.6',
                        shader: 'phong',
                        maximumScreenSpaceError: 32,
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 4, threshold: 0.4, zoomOffset: 0 });
        }).timeout(10000);

        it('fangzhicheng', done => {
            const resPath = 'BatchedDraco/deyihu/fzc3dtiles';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 1000, renderCount: 16, noGroup: true, zoomOffset: 2, pitch: 70 });
        }).timeout(15000);


        it('ktx2', done => {
            const resPath = 'BatchedDraco/ktx2/';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 10, renderCount: 1, zoomOffset: 1, noGroup: true });
        }).timeout(10000);

        it('crn', done => {
            const resPath = 'BatchedDraco/crn/';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 600, renderCount: 2, zoomOffset: 1, noGroup: true });
        }).timeout(15000);

        it('BatchedDraco-lwy', done => {
            const resPath = 'BatchedDraco/lwy';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1, noGroup: true });
        });

        it('BatchedDraco-lwy-phong', done => {
            const resPath = 'BatchedDraco/lwy';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'phong'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected-phong.png`, diffCount: 0, renderCount: 1, noGroup: true });
        });

        it('deyihu-khr_techniques_webgl', done => {
            const resPath = 'BatchedDraco/deyihu/taoyuan/';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'phong'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1, noGroup: true });
        });

        it('dayanta', done => {
            const resPath = 'BatchedDraco/dayanta/';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'phong',
                        ambientLight: [1, 1, 1],
                        heightOffset: -420
                    }
                ]
            });
            runner(() => {
                assert(map.getCenter().x.toFixed(3) === '108.959');
                done();
            }, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1, noGroup: true });
        });

        it('dayanta with coordOffset', done => {
            const resPath = 'BatchedDraco/dayanta';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'phong',
                        ambientLight: [1, 1, 1],
                        heightOffset: -420,
                        coordOffset: [0.001, 0]
                    }
                ]
            });
            runner(() => {
                // 因为coordOffset增加了0.001,所以坐标变了
                assert(map.getCenter().x.toFixed(3) === '108.960');
                done();
            }, layer, { path: `./integration/expected/${resPath}-offset/expected.png`, diffCount: 0, renderCount: 1, noGroup: true });
        });

        it('hengshan', done => {
            const resPath = 'BatchedDraco/deyihu/hengshan';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'phong',
                        ambientLight: [1, 1, 1],
                        heightOffset: -420
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 70, renderCount: 2, noGroup: true, threshold: 0.4, zoomOffset: 2 });
        });

        it('s3m-jinjiang', done => {
            const resPath = 'S3M/jinjiang';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/config.json`,
                        shader: 'phong',
                        ambientLight: [1, 1, 1],
                        heightOffset: -420
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 2, noGroup: true, threshold: 0.4, zoomOffset: 2 });
        });


        it('s3m-bim', done => {
            const resPath = 'S3M/bim';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/test@test.scp`,
                        shader: 'phong',
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getB3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const geoData = mesh.geometry.data;
                assert(!!geoData['batchId']);
                assert(!!geoData['aColor']);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 2, noGroup: true, threshold: 0.4, zoomOffset: 0 }, assertion);
        }).timeout(5000);

        it('s3m 3.0', done => {
            const resPath = 'S3M/s3m3';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/building.scp`,
                        shader: 'phong',
                        ambientLight: [1, 1, 1],
                        maxTextureSize: 1024,
                        maximumScreenSpaceError: 1.0,
                        heightOffset: 0,
                        alwaysShow: true
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 2, noGroup: true, threshold: 0.4, zoomOffset: 0 });
        });

        it('s3m-compressed vertex', done => {
            const resPath = 'S3M/guanyin';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/guanyin.json`,
                        shader: 'phong',
                        ambientLight: [1, 1, 1],
                        maxTextureSize: 1024,
                        maximumScreenSpaceError: 10.0,
                        heightOffset: 0,
                        alwaysShow: true
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 2, noGroup: true, threshold: 0.4, zoomOffset: 0 });
        });

        it('damon: khr_techinques_webgl missing attribute', done => {
            const resPath = 'BatchedDraco/damon';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset_whole.json`,
                        // shader: 'phong',
                        fillEmptyDataInMissingAttribute: 1,
                        maximumScreenSpaceError: 1,
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 5, threshold: 0.4, zoomOffset: 0 });
        }).timeout(10000);

        it('b3dm data is not bit alignment', done => {
            const resPath = 'BatchedDraco/noBitAlignment';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        // shader: 'phong',
                        fillEmptyDataInMissingAttribute: 1,
                        maximumScreenSpaceError: 1,
                        ambientLight: [1, 1, 1]
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 1, threshold: 0.4, zoomOffset: 0 });
        }).timeout(10000);

        it('node with multiple children, maptalks/issue#164', done => {
            const resPath = 'BatchedDraco/issue-164';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 2, threshold: 0.4, zoomOffset: 0 });
        }).timeout(10000);

        it('load b3dm with color0 attribute, maptalks/issue#152', done => {
            const resPath = 'BatchedDraco/color0';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 2, threshold: 0.4, zoomOffset: 0 });
        }).timeout(10000);

        it('load b3dm with khr_texture_transform extension, maptalks/issue#154', done => {
            const resPath = 'BatchedDraco/khrTextureTransform';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 50, renderCount: 2, threshold: 0.4, zoomOffset: 0 });
        }).timeout(10000);

    });

    context('Tilesets specs', () => {
        it('Cesium3DTiles/Tilesets/Tileset', done => {
            const resPath = 'Cesium3DTiles/Tilesets/Tileset';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 5, threshold: 0.35 });
        });


        it('Cesium3DTiles/Tilesets/TilesetEmptyRoot', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetEmptyRoot';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 4 });
        });

        // it('Cesium3DTiles/Tilesets/TilesetOfTilesets', done => {
        //     const resPath = 'Cesium3DTiles/Tilesets/TilesetOfTilesets';
        //     const layer = new Geo3DTilesLayer('3d-tiles', {
        //         services : [
        //             {
        //                 url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
        //                 shader: 'pbr'
        //             }
        //         ]
        //     });
        //     runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 5, threshold: 0.3 });
        // });

        it('Cesium3DTiles/Tilesets/TilesetPoints', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetPoints';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 9 });
        });

        it('Cesium3DTiles/Tilesets/TilesetRefinementMix', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetRefinementMix';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 6 });
        });

        it('Cesium3DTiles/Tilesets/TilesetReplacement1', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetReplacement1';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 4 });
        });

        it('Cesium3DTiles/Tilesets/TilesetReplacement2', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetReplacement2';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 2 });
        });

        it('Cesium3DTiles/Tilesets/TilesetReplacement3', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetReplacement3';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 4 });
        });

        it('Cesium3DTiles/Tilesets/TilesetReplacementWithViewerRequestVolume', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetReplacementWithViewerRequestVolume';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, {
                path: `./integration/expected/${resPath}/expected.png`,
                diffCount: 0,
                renderCount: 1,
                view: { "center":[-75.61160570397635,40.04212145083338],"zoom":21.708574377763522,"pitch":0,"bearing":0 }
            });

        });

        it('Cesium3DTiles/Tilesets/TilesetUniform', done => {
            const resPath = 'Cesium3DTiles/Tilesets/TilesetUniform';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, {
                path: `./integration/expected/${resPath}/expected.png`,
                diffCount: 0,
                renderCount: 17
            });

        });

        it('Cesium3DTiles/Tilesets/TilesetWithExternalResources', done => {
            // cesium中 i3dm和b3dm的大小都是10米，视觉上一样大，但因为3857投影下，b3dm模型里10米会被放大1.3倍，所以b3dm要比i3dm视觉上更大
            const resPath = 'Cesium3DTiles/Tilesets/TilesetWithExternalResources';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, {
                path: `./integration/expected/${resPath}/expected.png`,
                diffCount: 0,
                renderCount: 6
            });

        });

        it('Cesium3DTiles/Tilesets/TilesetWithTransforms', done => {
            // cesium中 i3dm和b3dm的大小都是10米，视觉上一样大，但因为3857投影下，b3dm模型里10米会被放大1.3倍，所以b3dm要比i3dm视觉上更大
            const resPath = 'Cesium3DTiles/Tilesets/TilesetWithTransforms';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, {
                path: `./integration/expected/${resPath}/expected.png`,
                diffCount: 0,
                renderCount: 2,
                noGroup: true
            });

        });

        it('Cesium3DTiles/Tilesets/TilesetWithViewerRequestVolume', done => {
            // cesium中 i3dm和b3dm的大小都是10米，视觉上一样大，但因为3857投影下，b3dm模型里10米会被放大1.3倍，所以b3dm要比i3dm视觉上更大
            const resPath = 'Cesium3DTiles/Tilesets/TilesetWithViewerRequestVolume';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        maximumScreenSpaceError: 1
                    }
                ]
            });
            runner(done, layer, {
                path: `./integration/expected/${resPath}/expected.png`,
                diffCount: 0,
                renderCount: 5
            });

        });
    });

    context('CMPT specs', () => {
        it('Cesium3DTiles/Composite/CompositeOnly', done => {
            const resPath = 'Cesium3DTiles/Composite/Composite';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 2 });
        });

        it('Cesium3DTiles/Composite/CompositeOfComposite', done => {
            const resPath = 'Cesium3DTiles/Composite/CompositeOfComposite';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 2 });
        });

        it('Cesium3DTiles/Composite/CompositeOfInstanced', done => {
            const resPath = 'Cesium3DTiles/Composite/CompositeOfInstanced';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 2 });
        });
    });


    context('Instanced specs', () => {
        it('Cesium3DTiles/Instanced/InstancedAnimated', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedAnimated';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedGltfExternal', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedGltfExternal';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedOct32POrientation', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedOct32POrientation';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedOrientation', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedOrientation';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedQuantized', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedQuantized';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedQuantizedOct32POrientation', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedQuantizedOct32POrientation';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedRedMaterial', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedRedMaterial';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedRTC', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedRTC';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedScale', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedScale';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedScaleNonUniform', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedScaleNonUniform';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedTextured', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedTextured';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'phong'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Instanced/InstancedWithBatchIds', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedWithBatchIds';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getI3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const { batchTable, batchTableBin } = mesh.properties;
                assert(batchTable.Height);
                assert(batchTableBin.byteLength === 0);
                const expected = [];
                for (let i = 0; i < 25; i++) {
                    expected.push(20);
                }
                assert.deepEqual(batchTable.Height, expected);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('Cesium3DTiles/Instanced/InstancedWithBatchTable', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedWithBatchTable';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getI3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const { batchTable, batchTableBin } = mesh.properties;
                assert(batchTable.Height);
                assert(batchTableBin.byteLength === 0);
                const expected = [];
                for (let i = 0; i < 25; i++) {
                    expected.push(20);
                }
                assert.deepEqual(batchTable.Height, expected);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('Cesium3DTiles/Instanced/InstancedWithBatchTableBinary', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedWithBatchTableBinary';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getI3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const { batchTable, batchTableBin, count } = mesh.properties;
                assert(batchTable.id);
                assert(batchTableBin.byteLength === 104);
                const id = renderer.readBatchData(batchTable.id, batchTableBin, count);
                const expected = [];
                for (let i = 0; i < 25; i++) {
                    expected.push(i);
                }
                assert.deepEqual(id.array, expected);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('Cesium3DTiles/Instanced/InstancedWithoutBatchTable', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedWithoutBatchTable';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getI3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const { batchTable, batchTableBin } = mesh.properties;
                assert(Object.keys(batchTable).length === 0);
                assert(batchTableBin.byteLength === 0);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('Cesium3DTiles/Instanced/InstancedWithTransform', done => {
            const resPath = 'Cesium3DTiles/Instanced/InstancedWithTransform';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

    });

    context('PNTS specs', () => {
        it('Cesium3DTiles/PointCloud/PointCloudBatched', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudBatched';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudConstantColor', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudConstantColor';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr',
                        pointSize: 5
                    }
                ]
            });
            // 因为颜色混合，diffCount 无法判定为0
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 500, renderCount: 1, threshold: 0.4 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudDraco', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudDraco';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudDracoBatched', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudDracoBatched';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });


        it('Cesium3DTiles/PointCloud/PointCloudDracoPartial', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudDracoPartial';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudNoColor', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudNoColor';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudNormals', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudNormals';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudNormalsOctEncoded', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudNormalsOctEncoded';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudQuantized', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudQuantized';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudQuantizedOctEncoded', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudQuantizedOctEncoded';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudRGB', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudRGB';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudRGB565', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudRGB565';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudRGBA', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudRGBA';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 200, renderCount: 1, threshold: 0.4 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudWGS84', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudWGS84';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/PointCloudWithPerPointProperties', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudWithPerPointProperties';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getPNTSMeshes();
                const mesh = Object.values(meshes)[0];
                assert(mesh.geometry.data['BATCH_ID']);
                const { batchTable, batchTableBin, count } = mesh.properties;
                assert(batchTable.id);
                const id = renderer.readBatchData(batchTable['id'], batchTableBin, count);
                assert(id.array[0] === 0);
                assert(id.array[999] === 999);
                const temperature = renderer.readBatchData(batchTable['temperature'], batchTableBin, count);
                const secondaryColor = renderer.readBatchData(batchTable['secondaryColor'], batchTableBin, count);
                assert(temperature.array.length === 1000);
                assert(temperature.array[0] === 0.03777329996228218);
                assert(secondaryColor.array.length === 3000);
                assert(secondaryColor.array[0] === 0.8115184903144836);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });


        it('Cesium3DTiles/PointCloud/PointCloudWithUnicodePropertyNames', done => {
            const resPath = 'Cesium3DTiles/PointCloud/PointCloudWithUnicodePropertyNames';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getPNTSMeshes();
                const mesh = Object.values(meshes)[0];
                assert(mesh.geometry.data['BATCH_ID']);
                const { batchTable, batchTableBin, count } = mesh.properties;
                assert(batchTable.id);
                const id = renderer.readBatchData(batchTable['id'], batchTableBin, count);
                assert(id.array[0] === 0);
                assert(id.array[999] === 999);
                // Cesium中读取batchTable的值逻辑在 PointCloud.js 中 pointCloud._parsedContent 下
                const temperature = renderer.readBatchData(batchTable['temperature ℃'], batchTableBin, count);
                const secondaryColor = renderer.readBatchData(batchTable['secondaryColor'], batchTableBin, count);
                assert(temperature.array.length === 1000);
                assert(temperature.array[0] === 0.28833329677581787);
                assert(secondaryColor.array.length === 3000);
                assert(secondaryColor.array[0] === 0.8115184903144836);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });
    });

    context('B3DM specs', () => {
        it('Cesium3DTiles/Batched/BatchedAnimated', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedAnimated';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'phong'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedColors', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedColors';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedColorsMix', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedColorsMix';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 300, renderCount: 10, threshold: 0.4 });
        });

        it('Cesium3DTiles/Batched/BatchedColorsTranslucent', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedColorsTranslucent';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 500, renderCount: 10, threshold: 0.4 });
        });


        it('Cesium3DTiles/Batched/BatchedDeprecated1', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedDeprecated1';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });


        it('Cesium3DTiles/Batched/BatchedDeprecated2', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedDeprecated2';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedNoBatchIds', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedNoBatchIds';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedTextured', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedTextured';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedTranslucent', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedTranslucent';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1, threshold: 0.4 });
        });

        it('Cesium3DTiles/Batched/BatchedTranslucentOpaqueMix', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedTranslucentOpaqueMix';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1, threshold: 0.4 });
        });


        it('Cesium3DTiles/Batched/BatchedWGS84', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWGS84';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/PointCloud/BatchedWithBatchTable', done => {
             const resPath = 'Cesium3DTiles/Batched/BatchedWithBatchTable';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getB3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const { batchTable, count } = mesh.properties;
                assert(count === 10);
                assert(batchTable.id);
                // const id = renderer.readBatchData(batchTable['id'], batchTableBin, count);
                const id = batchTable.id;
                assert(id[0] === 0);
                assert(id[9] === 9);
                // Cesium中读取batchTable的值逻辑在 PointCloud.js 中 pointCloud._parsedContent 下
                const info = batchTable.info;
                assert(info.length === 10);
                assert(info[0].name = 'building0' && info[0].year === 0);
                assert(!!mesh.geometry.data['_BATCHID']);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('Cesium3DTiles/PointCloud/BatchedWithBatchTableBinary', done => {
             const resPath = 'Cesium3DTiles/Batched/BatchedWithBatchTableBinary';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                const renderer = layer.getRenderer();
                const meshes = renderer.getB3DMMeshes();
                const mesh = Object.values(meshes)[0][0];
                const { batchTable, batchTableBin, count } = mesh.properties;
                assert(batchTable.id);
                const id = batchTable.id;
                assert(id[0] === 0);
                assert(id[9] === 9);
                // Cesium中读取batchTable的值逻辑在 PointCloud.js 中 pointCloud._parsedContent 下
                const cartographic = renderer.readBatchData(batchTable['cartographic'], batchTableBin, count);
                assert(cartographic.array.length === 30);
                assert(cartographic.array[0] === -1.31968);
            };
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('Cesium3DTiles/Batched/BatchedWithBoundingSphere', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithBoundingSphere';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedWithContentDataUri', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithContentDataUri';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedWithoutBatchTable', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithoutBatchTable';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedWithRtcCenter', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithRtcCenter';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedWithTransformBox', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithTransformBox';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedWithTransformRegion', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithTransformRegion';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedWithTransformSphere', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithTransformSphere';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });

        it('Cesium3DTiles/Batched/BatchedWithVertexColors', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithVertexColors';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            runner(done, layer, { path: `./integration/expected/${resPath}/expected.png`, diffCount: 0, renderCount: 1 });
        });


    });

    context('offset specs', () => {
        const offset = [8, -4];
        it('offset/BatchedWithTransformBox', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithTransformBox';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                offset,
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                assert.deepEqual(layer.getMap().getCenter().toArray(), [ -75.61758748734894, 40.04463327181864 ]);
            };
            runner(done, layer, { path: `./integration/expected/offset/BatchedWithTransformBox/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('offset/BatchedWithTransformRegion', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithTransformRegion';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                offset,
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                assert.deepEqual(layer.getMap().getCenter().toArray(), [ -75.61758747188696, 40.044633271818356 ]);
            };
            runner(done, layer, { path: `./integration/expected/offset/BatchedWithTransformRegion/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

        it('offset/BatchedWithTransformSphere', done => {
            const resPath = 'Cesium3DTiles/Batched/BatchedWithTransformSphere';
            const layer = new Geo3DTilesLayer('3d-tiles', {
                offset,
                services : [
                    {
                        url : `http://localhost:${PORT}/integration/fixtures/${resPath}/tileset.json`,
                        shader: 'pbr'
                    }
                ]
            });
            const assertion = layer => {
                assert.deepEqual(layer.getMap().getCenter().toArray(), [ -75.61758750281098, 40.04463327181864 ]);
            };
            runner(done, layer, { path: `./integration/expected/offset/BatchedWithTransformSphere/expected.png`, diffCount: 0, renderCount: 1 }, assertion);
        });

    })
});
