import {levelMap} from "./map.js";
import * as f from "https://cdn.jsdelivr.net/gh/RuntimeTerror418/webLib@v0.0.1-alpha/utility.js";


const metadata = {
    name: "RuntimeTerror418_sokoban_offline+puzzler",
    storage: false,
    storageJSON: `{"currentLevel": 0}`,
    version: "v1.0.0",
};

class Sokoban {

    // id reference to the canvas
    constructor(id) {
        this.ele = f.initCanvas2D(id).canvas;
        this.ctx = f.initCanvas2D(id).ctx;
        this.sprites = {};
        this.CHARACTER_ENUM = {
            ".": "outside",
            "#": "wall",
            "*": "point",
            " ": "ground",
            player: "@",
            point: "*",
            ground: " ",
            crate: "£",
            outside: ".",
            wall: "#",
        };
        this.maxLevel = 15;
        this.attainedLevel = 0;
        this.steps = 0;
        this.isActive = false;
        this.setDimension();
    }

    setDimension() {
        let W, H, min_;
        const play_scene = document.getElementById("play-scene").children[0];
        const header = play_scene.children[0];
        const footer = play_scene.children[2];

        play_scene.width = parseFloat(f.getPropertyValue(play_scene, "width"));
        header.height = parseFloat(f.getPropertyValue(header, "height")) / 100 * window.innerHeight;
        footer.height = parseFloat(f.getPropertyValue(footer, "height")) / 100 * window.innerHeight;
        W = window.innerWidth;
        H = window.innerHeight - header.height - footer.height;

        min_ = Math.min(W, H);
        this.tileSize = Math.floor(min_ / 9);
        this.width = this.tileSize * 9;
        this.height = this.width;
        this.ele.style.position = "relative";
        this.ele.style.left = W * 0.5 - this.width * 0.526 + "px";
        this.ele.style.top = H * 0.5 - this.width * 0.526 + "px";
    }

    set width(w) { this.ele.width = w; }

    get width() { return this.ele.width; }

    set height(h) { this.ele.height = h; }

    get height() { return this.ele.height; }

    set level(l) {
        this._level = l;
        document.getElementById("level-display-btn").innerHTML = `
        <b>Level:</b><br>${this._level + 1}`;
    };

    get level() { return this._level; }

    set steps(s) {
        this._step = s;
        document.getElementById("step-display-btn").innerHTML = `
        <b>Steps: </b><br>${this.steps}`;
    };

    get steps() { return this._step; }

    set repeat(r) {
        this._repeat = r;
        const btn = document.getElementById("reverse-action-btn");
        btn.innerHTML = `
        <i class="fa fa-reply text-muted"></i><br>
        <small class="text-muted">${this._repeat}</small>
        `;
        btn.disabled = this._repeat <= 0;
    }

    get repeat(){ return this._repeat; }

    authoriseLevel(maxLevel) {
        const level_btns = document.querySelectorAll(".level-btn");
        level_btns.forEach((btn, i) => {
            const level = parseInt(btn.innerHTML) - 1;
            if(level > maxLevel) {
                btn.disabled = true;
                btn.classList.remove("btn-outline-info");
                btn.classList.add("border");
            } else {
                btn.disabled = false;
                btn.classList.remove("border");
                btn.classList.add("btn-outline-info");
            }
        });
    }

    /**
     * Level actually start from 0-14 hence 1 should be deducted if the scale is 1-15
     * @param {Number} level level to be started
     */
    restart(level) {
        if(level > this.maxLevel) {
            this.isActive = false;
            alert("You have unlocked all level");
            this.level = 14;
        }
        this.map = [];
        this.crates = [];
        this.moveHistory = [];
        this.repeat = 0;
        this.steps = 0;
        this.level = level;
        this.isActive = true;
        if(this.level < 0) {
            f.accessLocalStorage(metadata).then(e => {
                this.level = e.data.currentLevel;
                this.initDefaultCharacter();
            }).catch(() => {
                this.level = this.attainedLevel || 0;
                this.initDefaultCharacter();
            });
        } else this.initDefaultCharacter();
    }

    initDefaultCharacter() {
        const mapString = levelMap[this.level].replaceAll("\n", "");
        for(let y=0; y < 9; y++) {
            this.map.push([]);
            for(let x=0; x < 9; x++) {
                const chr = mapString[y * 9 + x];
                this.map[y][x] = chr;
                if(chr === this.CHARACTER_ENUM.crate) 
                    this.crates.push({x, y, id:y*x, delivered: false});
                if(chr === this.CHARACTER_ENUM.player)
                    this.player = {x, y};
            }
        };
    }

    /**
     * Add player's task history into the moveHistory member data
     * @param {Number} x player's x-position
     * @param {Number} y player's y-position
     * @param {Object} crate the object previously delivered
     */
    addMove(x, y, crate=false) {
        const history = {player: [x, y]};
        if(crate) 
            history['crate'] = [crate.id, crate.x, crate.y];
        this.moveHistory.push(history);
        if(this.moveHistory.length > 4)
            this.moveHistory.shift();
        this.repeat = this.moveHistory.length;
    }

    // pop the last history and restore the game status to it
    reverseMove() {
        if(this.isActive) {
            const lastMove = this.moveHistory.pop();
            if(lastMove) {
                this.player.x = lastMove.player[0];
                this.player.y = lastMove.player[1];
                this.steps--;
                if(lastMove.crate) {
                    const crate = this.crates.filter(i => i.id === lastMove.crate[0]);
                    crate[0].x = lastMove.crate[1];
                    crate[0].y = lastMove.crate[2];
                }
                this.repeat = this.moveHistory.length;
                };
        }
    }

    /**
     * @param {String} nextDir the direction to check collision for
     */
    collisionCheck(nextDir) {
        if(this.isActive) {
            let vel = {x: 0, y: 0};
            const oldPlayer = [this.player.x, this.player.y];
            vel.x = nextDir === "right" ? 1 : nextDir === "left" ? -1 : 0;
            vel.y = nextDir === "down" ? 1 : nextDir === "up" ? -1 : 0;
            const nextPos = { x: this.player.x + vel.x,  y: this.player.y + vel.y};
            const tile = this.map[nextPos.y][nextPos.x];
            const boxExist = this.crates.filter(i => i.y === nextPos.y && i.x === nextPos.x);
            if(boxExist.length) {
                let newPos = {x: nextPos.x + vel.x, y: nextPos.y + vel.y};
                let tile_ = this.map[newPos.y][newPos.x];
                let boxExist_ = this.crates.filter(i => i.y === newPos.y && i.x === newPos.x);
                if(!boxExist_.length && tile_ != this.CHARACTER_ENUM.wall) {
                    this.player.x += vel.x;
                    this.player.y += vel.y;
                    this.addMove(...oldPlayer, boxExist[0]);
                    boxExist[0].x += vel.x;
                    boxExist[0].y += vel.y;
                    this.steps++;
                }
            } else {
                if(tile != this.CHARACTER_ENUM.wall) {
                    this.player.x += vel.x;
                    this.player.y += vel.y;
                    this.steps++;
                    this.addMove(...oldPlayer);
                }
            };
        }
    }

    drawFunc(ctx) {
        const sz = this.tileSize;

        this.map.forEach((row, i) => {
            row.forEach((col, j) => {
                const px = j * this.tileSize;
                const py = i * this.tileSize;
                const symbolRep = this.CHARACTER_ENUM[col];
                if(symbolRep)
                    ctx.drawImage(this.sprites[symbolRep], px, py, sz, sz);
                else 
                    ctx.drawImage(this.sprites.ground, px, py, sz, sz);
            });
        });
    
        this.crates.forEach((crate, i) => {
            const tile = this.map[crate.y][crate.x];
            const px = crate.x * sz;
            const py = crate.y * sz;
            if(tile === this.CHARACTER_ENUM.point) {
                crate.delivered = true;
                ctx.drawImage(this.sprites.crate, px, py, sz, sz);
                ctx.fillStyle = "rgba(255, 0, 0, 0.23)";
                ctx.fillRect(px, py, sz, sz);
            } else {
                crate.delivered = false;
                ctx.drawImage(this.sprites.crate, crate.x * sz, crate.y * sz, sz, sz);
            }
        });
    
        if(this.crates.every(crate => crate.delivered)) {
            if(this.isActive) {
                this.timer = f.setIntervalRaf();
                this.timer.start();
                this.isActive = false;
            } else {
                if(this.timer && this.timer.diff >= 3) {    // new level after 3 seconds
                    this.level++;
                    f.accessLocalStorage(metadata).then(e => {
                        e.data.currentLevel = Math.max(e.data.currentLevel, this.level);
                        e.table.setItem(metadata.name, JSON.stringify(e.data));
                        this.restart(this.level);
                        this.timer = undefined;
                    }).catch(() => {
                        this.attainedLevel = Math.max(this.attainedLevel, this.level);
                        this.restart(this.level);
                        this.timer = undefined;
                    });
                }
            }
        };
    
        ctx.drawImage(this.sprites.player, 
            this.player.x * sz, this.player.y * sz, sz, sz);
    }

    start() {
        const animate = () => {
            if(typeof this.update === "function")
                this.update(this.ctx);
            else throw new Error("Update method is not callable");
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    reset(level) {
        this.update = () => {};
        this.restart(level);
        this.update = this.drawFunc;
        this.start();
    }
};


/**
 * Method defined for all events in the game... 
 * These methods are called once after preloading
 */
const events  = {

    miscellaneous: (back_btns, menu_scene, scene, game) => {
        // adding functionlity to the back toggler button
        back_btns.forEach((btn, i) => {
            btn.addEventListener("click", e => {
                toggleDisplay(menu_scene, ...scene);
            });
        });

        document.getElementById("reset-level-btn")
        .addEventListener('click', function(e) {
            f.accessLocalStorage(metadata).then(e => {
                e.data.currentLevel = 0;
                e.table.setItem(metadata.name, JSON.stringify(e.data));
                game.attainedLevel(0);
            }).catch(() => {
                game.attainedLevel = 0;
                game.authoriseLevel(0);
            });
        });

        // save current map
        document.getElementById("save-current-state-btn")
        .addEventListener('click', function() {
            alert("This feauture is coming soon");
        });
    },

    levelSwitch: (btns, play_scene, scene, game) => {
        btns.forEach((btn, i) => {
            btn.addEventListener("click", e => {
                const level = parseInt(btn.innerHTML) - 1;
                toggleDisplay(play_scene, ...scene);
                game.reset(level);
            });
        });
    },

    menuSwitch: (btns, scene, game) => {
        btns.forEach((btn, i) => {
            btn.addEventListener("click", e => {
                const id = btn.id.split("-")[0];
                const scene_ = document.getElementById(`${id}-scene`);
                if(id === "play") {
                    toggleDisplay(scene_, ...scene);
                    game.reset(-1);
                } else {
                    game.isActive = false;
                    toggleDisplay(scene_, ...scene);
                }
            });
        });
    },

    gameControl: (game) => {

        // keyboard control
        console.log("Added keyboard event");
        window.addEventListener("keydown", e => {
            if(game.isActive) {
                const key = e.key.toLowerCase();
                if(key.includes("arrow"))  
                game.collisionCheck(key.substr(5));
                else if(e.key === " ")
                    game.reverseMove();
            }
        });

        // button controls
        console.log("Added direction-button event");
        [...document.querySelectorAll(".control")].forEach(
            (btn, i) => { btn.addEventListener("click", e => {
                game.collisionCheck(btn.id.split("-")[1]);
            });
        });

        document.getElementById("restart-current-level-btn")
        .addEventListener('click', function() {
            game.reset(game.level);
        });

        document.getElementById("reverse-action-btn")
        .addEventListener("click", function() {
            game.reverseMove();
        });
    }
};


/**
 * Toggle display between elements
 * @param {HTMLElement} block element to be displayed
 * @param  {...any} hidden elements to be hidden
 */
const toggleDisplay = (block, ...hidden) => {
    hidden.forEach(ele => ele.style.display = "none");
    block.style.display = "block";
};


const main = () => {
    const scene = document.querySelectorAll(".scene");
    const menu_btns = document.querySelectorAll(".menu-btn");
    const back_btns = document.querySelectorAll(".toggle-btn");
    const level_btns = document.querySelectorAll(".level-btn");
    const menu_scene = document.getElementById("menu-scene");
    const play_scene = document.getElementById("play-scene");
    const level_menu = document.getElementById("level-menu");
    const game = new Sokoban("cvs");

    /**
     * preload all assets with promise and it resolves to 
     * toggling the screen to the main menu, the storage is access so users 
     * can access the already passed levels
     */
    f.loadAllImages(game.sprites, "crate", "ground", "outside", 
    "player", "point", "wall").then(() => {
        
        console.log("Assets have been loaded successfully");
        game.isActive = false;
        toggleDisplay(menu_scene, document.getElementById("preloader"));
        events.menuSwitch(menu_btns, scene, game);
        events.levelSwitch(level_btns, play_scene, scene, game);
        events.miscellaneous(back_btns, menu_scene, scene, game);
        events.gameControl(game);

        // add Eventlistener to the level button
        f.accessLocalStorage(metadata).then(e => {
            if(e.data.currentLevel === 0) 
                console.log("Local storage initialised");
            else console.log("Resuming sokoban game");
            level_menu.addEventListener("click", () => {
                f.accessLocalStorage(metadata).then(e => {
                    game.authoriseLevel(e.data.currentLevel);
                });
            });
        }).catch(() => {
            console.warn("Local storage could not be found on this page");
            level_menu.addEventListener("click", () => {
                game.authoriseLevel(game.attainedLevel);
            });
        });

    }).catch(e => {
        toggleDisplay(document.getElementById("preloader"), ...scene);
        const preloader_text = document.getElementById("preloader-text");
        preloader_text.innerHTML = "Failed to load image assets";
        preloader_text.className += " text-danger";
        console.error("Failed to load assets");
        throw e;
    });


};  // end of main function

addEventListener("load", main);