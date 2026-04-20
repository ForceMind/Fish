class FishFormation {
    static SCHOOL_FORMATIONS = {
        opening: [
            {
                key: 'opening-fish1',
                spacingScale: 1.2,
                verticalSpacingScale: 0.9,
                cooldownMin: 220,
                cooldownRange: 80,
                directionOffsetFactor: 0.14,
                angleJitterRange: 0.03,
                speedMultiplier: 1.02,
                animationSpeedMultiplier: 1.04,
                grid: [
                    [0, 0, 1, 0, 0],
                    [0, 1, 1, 1, 0],
                    [1, 1, 1, 1, 1],
                    [0, 1, 1, 1, 0],
                    [0, 0, 1, 0, 0]
                ]
            },
            {
                key: 'opening-fish2',
                spacingScale: 1,
                verticalSpacingScale: 0.52,
                cooldownMin: 220,
                cooldownRange: 80,
                directionOffsetFactor: 0.14,
                angleJitterRange: 0.03,
                speedMultiplier: 1,
                animationSpeedMultiplier: 1.02,
                grid: [
                    [0, 0, 2, 0, 0],
                    [0, 0, 0, 2, 0],
                    [0, 0, 0, 0, 2],
                    [0, 0, 0, 2, 0],
                    [0, 0, 2, 0, 0]
                ]
            }
        ],
        standard: [
            {
                key: 'standard-fish2',
                spacingScale: 1,
                verticalSpacingScale: 0.92,
                cooldownMin: 260,
                cooldownRange: 120,
                directionOffsetFactor: 0.16,
                angleJitterRange: 0.05,
                speedMultiplier: 1,
                animationSpeedMultiplier: 1,
                grid: [
                    [0, 0, 0, 0, 0],
                    [0, 0, 2, 0, 0],
                    [0, 2, 2, 2, 0],
                    [0, 0, 2, 0, 0],
                    [0, 0, 0, 0, 0]
                ]
            },
            {
                key: 'standard-fish3',
                spacingScale: 1.2,
                verticalSpacingScale: 0.64,
                cooldownMin: 260,
                cooldownRange: 120,
                directionOffsetFactor: 0.16,
                angleJitterRange: 0.05,
                speedMultiplier: 1,
                animationSpeedMultiplier: 1,
                grid: [
                    [0, 0, 0, 0, 0],
                    [0, 3, 3, 3, 0],
                    [0, 3, 3, 3, 0],
                    [0, 3, 3, 3, 0],
                    [0, 0, 0, 0, 0]
                ]
            }
        ],
        fast: [
            {
                key: 'fast-fish1',
                spacingScale: 1.2,
                verticalSpacingScale: 0.82,
                cooldownMin: 300,
                cooldownRange: 140,
                directionOffsetFactor: 0.24,
                angleJitterRange: 0.03,
                speedMultiplier: 1.35,
                animationSpeedMultiplier: 1.25,
                grid: [
                    [0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0],
                    [1, 1, 1, 1, 3],
                    [0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0]
                ]
            },
            {
                key: 'fast-fish2',
                spacingScale: 1,
                verticalSpacingScale: 0.84,
                cooldownMin: 300,
                cooldownRange: 140,
                directionOffsetFactor: 0.22,
                angleJitterRange: 0.03,
                speedMultiplier: 1.28,
                animationSpeedMultiplier: 1.2,
                targetSpeed: 1.2,
                grid: [
                    [0, 0, 2, 0, 0],
                    [0, 2, 2, 2, 0],
                    [0, 2, 2, 2, 0],
                    [0, 2, 2, 2, 0],
                    [0, 0, 2, 0, 0]
                ]
            }
        ],
        escort: [
            {
                key: 'escort-fish5',
                spacingScale: 0.78,
                verticalSpacingScale: 0.46,
                cooldownMin: 340,
                cooldownRange: 150,
                directionOffsetFactor: 0.12,
                angleJitterRange: 0.025,
                animationSpeedMultiplier: 1,
                targetSpeed: 1.2,
                grid: [
                    [0, 0, 0, 0, 0],
                    [0, 0, 1, 0, 0],
                    [1, 1, 8, 1, 1],
                    [0, 0, 1, 0, 0],
                    [0, 0, 0, 0, 0]
                ]
            }
        ]
    };
}

globalThis.FishFormation = FishFormation;
