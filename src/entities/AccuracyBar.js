class AccuracyBar extends PIXI.Container {
    constructor() {
        super();
        this.power = 1;
        this.barWidth = 210;
        this.barHeight = 12;
        this.indicatorPos = 0.5; // 0 to 1
        this.indicatorSpeed = 0.01;
        this.indicatorDirection = 1;

        this.feedbackContainer = new PIXI.Container();
        this.addChild(this.feedbackContainer);

        this.setupGraphics();
    }

    setupGraphics() {
        this.bg = new PIXI.Graphics();
        this.greenArea = new PIXI.Graphics();
        this.indicator = new PIXI.Graphics();

        this.addChild(this.bg);
        this.addChild(this.greenArea);
        this.addChild(this.indicator);

        this.updateVisuals();
    }

    setPower(power) {
        this.power = power;
        this.updateVisuals();
    }

    getGreenWidth() {
        // 1号炮绿色区域宽（0.8），7号炮绿色区域窄（0.15）
        const maxWidth = 0.8;
        const minWidth = 0.15;
        const ratio = (this.power - 1) / 6;
        return maxWidth - (maxWidth - minWidth) * ratio;
    }

    updateVisuals() {
        // Background
        this.bg.clear();
        this.bg.roundRect(-this.barWidth / 2, -this.barHeight / 2, this.barWidth, this.barHeight, 4);
        this.bg.fill({ color: 0xFFD700, alpha: 0 });

        // Green target area
        const greenWidthRatio = this.getGreenWidth();
        const gw = this.barWidth * greenWidthRatio;
        this.greenArea.clear();
        this.greenArea.rect(-gw / 2, -this.barHeight / 2, gw, this.barHeight, 2);
        this.greenArea.fill({ color: 0x00FF00, alpha: 1 }); // Green

        // Render indicator based on current pos
        this.renderIndicator();
    }

    renderIndicator() {
        const x = (this.indicatorPos - 0.5) * this.barWidth;
        this.indicator.clear();
        this.indicator.rect(x - 1, -this.barHeight / 2 - 2, 4, this.barHeight + 4);
        this.indicator.fill({ color: 0xFFFFFF });
        this.indicator.stroke({ color: 0x000000, width: 1 });
    }

    update(delta) {
        this.indicatorPos += this.indicatorDirection * this.indicatorSpeed * delta;

        if (this.indicatorPos >= 1) {
            this.indicatorPos = 1;
            this.indicatorDirection = -1;
        } else if (this.indicatorPos <= 0) {
            this.indicatorPos = 0;
            this.indicatorDirection = 1;
        }

        this.renderIndicator();

        // Update feedback animations
        for (let i = this.feedbackContainer.children.length - 1; i >= 0; i--) {
            const text = this.feedbackContainer.children[i];
            text.y -= 0.5 * delta;
            text.alpha -= 0.01 * delta;
            if (text.alpha <= 0) {
                this.feedbackContainer.removeChild(text);
            }
        }
    }

    showFeedback(accuracy) {
        let label = "Oh~No";
        let color = "#ff0000";

        if (accuracy >= 1.0) {
            label = "Great";
            color = "#00ff00";
        } else if (accuracy >= 0.6) {
            label = "Good";
            color = "#ffd700";
        }

        const text = new PIXI.Text({
            text: label,
            style: {
                fill: color,
                fontSize: 18,
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: 3 }
            }
        });

        text.anchor.set(0.5);
        text.y = -35;
        this.feedbackContainer.addChild(text);
    }

    getAccuracy() {
        const greenWidth = this.getGreenWidth();
        const halfGreen = greenWidth / 2;
        const center = 0.5;
        const dist = Math.abs(this.indicatorPos - center);

        if (dist <= halfGreen) {
            // Great! 给予 20% 的额外捕获概率加成
            return 1.2;
        } else {
            // 距离绿色边缘越远，衰减越大
            const overflow = dist - halfGreen;
            const maxOverflow = 0.5 - halfGreen;
            // 线性衰减到 0.2
            const decay = Math.max(0.2, 1.0 - (overflow / maxOverflow) * 0.8);
            return decay;
        }
    }
}

globalThis.AccuracyBar = AccuracyBar;
