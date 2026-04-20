const WaterEffect = {
    displacementSprite: null,
    displacementFilter: null,
    overlaySprite: null,
    time: 0,
    liveMode: false,
    updateStep: 1,
    updateAccumulator: 0,

    init(app, width, height) {
        const smallSize = 64;
        const bigSize = 256;

        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = smallSize;
        smallCanvas.height = smallSize;
        const smallCtx = smallCanvas.getContext('2d');
        const imageData = smallCtx.createImageData(smallSize, smallSize);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const val = Math.floor(Math.random() * 255);
            imageData.data[i] = val;
            imageData.data[i + 1] = val;
            imageData.data[i + 2] = val;
            imageData.data[i + 3] = 255;
        }
        smallCtx.putImageData(imageData, 0, 0);

        const canvas = document.createElement('canvas');
        canvas.width = bigSize;
        canvas.height = bigSize;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(smallCanvas, 0, 0, bigSize, bigSize);

        const displacementTexture = PIXI.Texture.from(canvas);
        this.displacementSprite = new PIXI.Sprite(displacementTexture);
        this.displacementSprite.width = width;
        this.displacementSprite.height = height;
        this.displacementSprite.texture.source.style.addressMode = 'repeat';
        app.stage.addChild(this.displacementSprite);

        this.displacementFilter = new PIXI.DisplacementFilter({
            sprite: this.displacementSprite,
            scale: { x: 5, y: 5 }
        });

        this.displacementSprite.renderable = false;

        try {
            const overlayTexture = ResourceManager.textures.effect_overlay;
            if (overlayTexture) {
                this.overlaySprite = new PIXI.Sprite(overlayTexture);
                this.overlaySprite.width = width;
                this.overlaySprite.height = height;
                this.overlaySprite.blendMode = 'screen';
                this.overlaySprite.alpha = 0.45;
            }
        } catch (e) {
            console.warn('水光叠加层创建失败:', e);
        }
    },

    update(delta) {
        this.updateAccumulator += delta;

        if (this.updateAccumulator < this.updateStep) {
            return;
        }

        delta = this.updateAccumulator;
        this.updateAccumulator = 0;
        this.time += delta;

        if (this.displacementSprite) {
            const amplitudeX = 19;
            const amplitudeY = 17;

            this.displacementSprite.x = Math.sin(this.time * 0.03) * amplitudeX;
            this.displacementSprite.y = Math.cos(this.time * 0.02) * amplitudeY;
        }
    }
};
