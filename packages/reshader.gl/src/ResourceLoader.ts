import Eventable from './common/Eventable';
import Ajax from './common/Ajax.js';
import { UrlModifierFunction } from './types/typings';
import { urlProxy } from '@maptalks/common';

type CachedResource = {
    image: any,
    count: number
}

type PromiseResource = {
    url: string,
    data: any
}

class InnerResourceLoader {
    defaultTexture?: Uint8Array
    defaultCubeTexture: number[]
    urlModifier?: UrlModifierFunction
    private resources: Record<string, CachedResource>
    private _count?: number

    constructor(DEFAULT_TEXTURE: Uint8Array, urlModifier?: UrlModifierFunction) {
        this.defaultTexture = DEFAULT_TEXTURE;
        this.defaultCubeTexture = new Array(6);
        this.urlModifier = urlModifier;

        //TODO 把this.resources换成LRU队列，控制缓存的资源数量
        this.resources = {};
    }

    setURLModifier(urlModifier: UrlModifierFunction) {
        this.urlModifier = urlModifier;
    }

    get(url: string | string[]) {
        if (Array.isArray(url)) {
            return this._loadImages(url);
        } else {
            return this._loadImage(url);
        }
    }

    getArrayBuffer(url: string | string[]): Promise<PromiseResource | PromiseResource[]> {
        url = urlProxy(url);
        if (Array.isArray(url)) {
            const promises = url.map(u => this.getArrayBuffer(u) as Promise<PromiseResource>);
            return Promise.all(promises);
        } else {
            return new Promise((resolve, reject) => {
                let realUrl = url;
                if (this.urlModifier) {
                    realUrl = this.urlModifier(url);
                }
                Ajax.getArrayBuffer(realUrl, (err, buffer) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ url, data: buffer });
                    }
                });
            });
        }
    }

    disposeRes(url: string | string[]): this {
        url = urlProxy(url);
        if (Array.isArray(url)) {
            url.forEach(u => this._disposeOne(u));
        } else {
            this._disposeOne(url);
        }
        return this;
    }

    isLoading(): boolean {
        return this._count && this._count > 0;
    }

    getDefaultTexture(url: string | string[]): Uint8Array | number[] {
        url = urlProxy(url);
        if (!Array.isArray(url)) {
            return this.defaultTexture;
        } else {
            return this._getBlankTextures(url.length);
        }
    }

    _disposeOne(url: string) {
        url = urlProxy(url);
        const resources = this.resources;
        if (!resources[url]) {
            return;
        }
        resources[url].count--;
        if (resources[url].count <= 0) {
            delete resources[url];
        }
    }

    _loadImage(url: string): Promise<PromiseResource> {
        url = urlProxy(url);
        const resources = this.resources;
        if (resources[url]) {
            return Promise.resolve({ url, data: resources[url].image });
        }
        const promise = new Promise<PromiseResource>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                resources[url] = {
                    image: img,
                    count: 1
                };
                resolve({ url, data: img });
            };
            img.onerror = function (err) {
                reject(err);
            };
            img.onabort = function () {
                reject(`image(${url}) loading aborted.`);
            };
            if (this.urlModifier) {
                img.src = this.urlModifier(url);
            } else {
                img.src = url;
            }

        });
        return promise;
    }

    _loadImages(urls): Promise<PromiseResource[]> {
        const promises = urls.map(url => this._loadImage(url));
        const promise = Promise.all(promises);
        return promise;
    }

    _getBlankTextures(count) {
        const t = new Array(count);
        for (let i = 0; i < 6; i++) {
            t.push(this.defaultTexture);
        }
        return t;
    }
}

class ResourceLoader extends Eventable(InnerResourceLoader) { }

export default ResourceLoader;
