class Player {
    constructor() {
        this.container = new PIXI.Container();
        this.localCoins = 1000;
        this.bullets = [];

        this.cannon = new Cannon();
        this.cannon.x = Game.width / 2;
        this.cannon.y = Game.height - 10;
        this.container.addChild(this.cannon);

        this.accuracyBar = new AccuracyBar();
        this.container.addChild(this.accuracyBar);

        this.setupUI();
    }

    setupUI() {
        this.minusBtn = new PIXI.Sprite(ResourceManager.getTexture("bottom", [132, 72, 44, 31]));
        this.minusBtn.interactive = true;
        this.minusBtn.anchor.set(0.5);
        this.minusBtn.on('pointerdown', (e) => {
            e.stopPropagation();
            this.cannon.setPower(this.cannon.power - 1);
            this.accuracyBar.setPower(this.cannon.power);
            AudioManager.playUI();
        });

        this.plusBtn = new PIXI.Sprite(ResourceManager.getTexture("bottom", [44, 72, 44, 31]));
        this.plusBtn.interactive = true;
        this.plusBtn.anchor.set(0.5);
        this.plusBtn.on('pointerdown', (e) => {
            e.stopPropagation();
            this.cannon.setPower(this.cannon.power + 1);
            this.accuracyBar.setPower(this.cannon.power);
            AudioManager.playUI();
        });

        this.container.addChild(this.minusBtn, this.plusBtn);

        this.coinText = new PIXI.Text({
            text: this.getDisplayedCoins().toString().padStart(6, '0'),
            style: {
                fill: '#000000',
                fontSize: 20,
                fontWeight: 'bold',
                letterSpacing: 12
            }
        });
        this.container.addChild(this.coinText);

        this.onResize(Game.width, Game.height);
    }

    onResize(width, height) {
        this.cannon.x = width / 2 + 50;
        this.cannon.y = height - 10;

        this.minusBtn.x = width / 2 - 25;
        this.minusBtn.y = height - 35;

        this.plusBtn.x = width / 2 + 125;
        this.plusBtn.y = height - 35;

        this.accuracyBar.x = width / 2 + 268;
        this.accuracyBar.y = height - 17;

        this.coinText.x = width / 2 - 360;
        this.coinText.y = height - 27;
    }

    getDisplayedCoins() {
        return this.localCoins;
    }

    renderCoins() {
        this.coinText.text = this.getDisplayedCoins().toString().padStart(6, '0');
    }

    fire(targetGlobalPos) {
        const canFire = this.consumeCoins(this.cannon.power);

        if (!canFire) return;

        const dx = targetGlobalPos.x - this.cannon.x;
        const dy = targetGlobalPos.y - this.cannon.y;
        const rotation = Math.atan2(dy, dx) + Math.PI / 2;

        this.cannon.fire(rotation);

        const accuracy = this.accuracyBar.getAccuracy();
        this.accuracyBar.showFeedback(accuracy);
        const bullet = new Bullet(this.cannon.power, rotation);
        bullet.accuracyMult = accuracy;
        bullet.x = this.cannon.x;
        bullet.y = this.cannon.y;
        this.bullets.push(bullet);
        Game.app.stage.addChild(bullet);

        Game.coinsSpentSinceLastSchool = (Game.coinsSpentSinceLastSchool || 0) + this.cannon.power;
    }

    consumeCoins(amount) {
        if (this.localCoins < amount) {
            return false;
        }

        this.localCoins -= amount;
        this.renderCoins();

        return true;
    }

    addCoin(amount) {
        if (amount <= 0) {
            return;
        }

        this.localCoins += amount;
        this.renderCoins();
        AudioManager.playBubble();
    }

    updateBullets(delta) {
        if (this.accuracyBar) {
            this.accuracyBar.update(delta);
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(delta);
            if (b.isDead) {
                Game.app.stage.removeChild(b);
                this.bullets.splice(i, 1);
            }
        }
    }
}
