class Cannon extends PIXI.Container {
    constructor() {
        super();
        this.power = 1;
        this.setupSprite();
    }

    setupSprite() {
        if (this.sprite) this.removeChild(this.sprite);

        const config = {
            1: { id: "cannon1", width: 74, height: 74, regX: 37, regY: 45 },
            2: { id: "cannon2", width: 74, height: 76, regX: 37, regY: 46 },
            3: { id: "cannon3", width: 74, height: 76, regX: 37, regY: 46 },
            4: { id: "cannon4", width: 74, height: 83, regX: 37, regY: 52 },
            5: { id: "cannon5", width: 74, height: 85, regX: 37, regY: 55 },
            6: { id: "cannon6", width: 74, height: 90, regX: 37, regY: 58 },
            7: { id: "cannon7", width: 74, height: 94, regX: 37, regY: 60 }
        };

        const type = config[this.power];
        const frames = [];
        for (let i = 0; i < 5; i++) {
            frames.push(ResourceManager.getTexture(type.id, [0, i * type.height, type.width, type.height]));
        }

        this.sprite = new PIXI.AnimatedSprite(frames);
        this.sprite.anchor.set(type.regX / type.width, type.regY / type.height);
        this.sprite.loop = false;
        this.sprite.animationSpeed = 0.2;
        this.addChild(this.sprite);
    }

    setPower(power) {
        this.power = power;
        if (this.power > 7) this.power = 1;
        if (this.power < 1) this.power = 7;
        this.setupSprite();
    }

    fire(rotation) {
        this.rotation = rotation;
        this.sprite.gotoAndPlay(0);
        AudioManager.playFire();
    }
}
