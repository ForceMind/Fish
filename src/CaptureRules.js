class CaptureRules {
    static highPowerCap = 0.9;
    static rarityWeight = 20; // 稀有度权重分母

    static getSingleCaptureChance({ bulletPower, fishCoin, fishRarity, accuracyMult = 1.0 }) {
        const normalizedBulletPower = Number(bulletPower || 0);
        const normalizedFishCoin = Number(fishCoin || 0);
        const normalizedFishRarity = Number(fishRarity || 1);

        if (normalizedBulletPower <= 0 || normalizedFishCoin <= 0) {
            return 0;
        }

        // 基础经济概率 (炮等级/鱼价值)
        const economyChance = normalizedBulletPower / normalizedFishCoin;
        // 稀有度衰减项 (稀有度/20)
        const rarityDecay = normalizedFishRarity / CaptureRules.rarityWeight;
        
        // 公式：经济概率 - 稀有度衰减，并附加 1% 的保底概率
        let captureChance = Math.max(0.01, economyChance - rarityDecay);

        // 应用全局最高命中率上限 (90%)
        captureChance = Math.min(captureChance, CaptureRules.highPowerCap);

        // 应用准度衰减
        captureChance *= accuracyMult;

        return Math.max(0, captureChance);
    }

    static getFishCaptureChance(bulletPower, fishType = {}, accuracyMult = 1.0) {
        return CaptureRules.getSingleCaptureChance({
            bulletPower,
            fishCoin: fishType.coin,
            fishRarity: fishType.rarity,
            accuracyMult
        });
    }
}

globalThis.CaptureRules = CaptureRules;
