import Phaser from 'phaser';
import CONFIG from './core/config/game';
import BootScene from './core/scenes/boot/BootScene';
import GameScene from './core/scenes/game/GameScene';
export default class DinoGameInstance extends Phaser.Game {
    static CONFIG = CONFIG.GAME;

    constructor(config, callbacks) {
        super(config);
        this.callbacks = callbacks;
        this.registerResizeHandler();
        this.addScenes();
        this.startScene();
    }

    registerResizeHandler() {
        this.scale.on('resize', () => {
            const { parentSize } = this.scale;
            const { width, height } = parentSize;

            if (width === this.prevParentWidth && height === this.prevParentHeight) {
                return;
            }

            this.prevParentWidth = width;
            this.prevParentHeight = height;
            this.resize(parentSize);
        });
    }

    addScenes() {
        this.scene.add(BootScene.CONFIG.NAME, BootScene);
        this.scene.add(GameScene.CONFIG.NAME, GameScene);
    }

    startScene() {
        this.scene.start(BootScene.CONFIG.NAME);
    }

    resize(parentSize) {
        const { width: parentWidth, height: parentHeight } = parentSize;
        const gameWidth = parentWidth < 600 || parentWidth < parentHeight
            ? DinoGameInstance.CONFIG.WIDTH.PORTRAIT
            : DinoGameInstance.CONFIG.WIDTH.LANDSCAPE;
        const gameHeight = DinoGameInstance.CONFIG.HEIGHT;

        this.canvas.style.width = `${parentWidth}px`;
        this.canvas.style.height = `${gameHeight * (parentWidth / gameWidth)}px`;
        this.scale.resize(gameWidth, gameHeight);
    }
}
