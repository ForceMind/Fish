const ResourceManager = {
    textures: {},
    animations: {},
    sources: [
        {id:"mainbg", src:"images/game_bg_2_hd.jpg"},
        {id:"effect_overlay", src:"images/effect_overlay.png"},
        {id:"bottom", src:"images/bottom.png"},
        {id:"fish1", src:"images/fish1.png"},
        {id:"fish2", src:"images/fish2.png"},
        {id:"fish3", src:"images/fish3.png"},
        {id:"fish4", src:"images/fish4.png"},
        {id:"fish5", src:"images/fish5.png"},
        {id:"fish6", src:"images/fish6.png"},
        {id:"fish7", src:"images/fish7.png"},
        {id:"fish8", src:"images/fish8.png"},
        {id:"fish9", src:"images/fish9.png"},
        {id:"fish10", src:"images/fish10.png"},
        {id:"shark1", src:"images/shark1.png"},
        {id:"shark2", src:"images/shark2.png"},
        {id:"cannon1", src:"images/cannon1.png"},
        {id:"cannon2", src:"images/cannon2.png"},
        {id:"cannon3", src:"images/cannon3.png"},
        {id:"cannon4", src:"images/cannon4.png"},
        {id:"cannon5", src:"images/cannon5.png"},
        {id:"cannon6", src:"images/cannon6.png"},
        {id:"cannon7", src:"images/cannon7.png"},
        {id:"bullet", src:"images/bullet.png"},
        {id:"web", src:"images/web.png"},
        {id:"numBlack", src:"images/number_black.png"},
        {id:"coinAni1", src:"images/coinAni1.png"},
        {id:"coinAni2", src:"images/coinAni2.png"},
        {id:"coinText", src:"images/coinText.png"}
    ],

    async load() {
        const loadPromises = this.sources.map(source => {
            return PIXI.Assets.load(source.src).then(texture => {
                this.textures[source.id] = texture;
            });
        });
        await Promise.all(loadPromises);
    },

    getTexture(id, rect) {
        if (!this.textures[id]) return null;
        const baseTexture = this.textures[id];
        return new PIXI.Texture({
            source: baseTexture.source,
            frame: new PIXI.Rectangle(rect[0], rect[1], rect[2], rect[3])
        });
    },

    getAnimation(id, frames) {
        return frames.map(f => this.getTexture(id, f.rect));
    }
};
