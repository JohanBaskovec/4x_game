import React from "react";

const {useEffect} = require("react");

const {useRef} = require("react");
const {
  newCity,
  newUnit,
  moveUnitToTile,
  addUnitToPlayer,
  unitTypes,
  getUnitById,
  getTile,
} = require('4xgame_common');

class Game {
  constructor(canvas) {
    const context = canvas.getContext('2d')
    this.state = 'loading';
    this.canvas = canvas;
    this.context = context;
    this.current = null;
    this.commandQueue = [];
    this.selectedUnitId = null;

    this.canvasPosition = {
      x: canvas.offsetLeft,
      y: canvas.offsetTop,
    };

    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      switch (this.state) {
        case 'inProgress':
          if (this.selectedUnitId != null) {
            const unit = getUnitById(this.current.world, this.selectedUnitId);
            const mouse = this.getCanvasClickPosition(e);
            const tile = getTile(this.current.world, mouse.tile);
            if (tile.reachable) {
              moveUnitToTile(this.current.world, unit, tile);
              this.computeReachableTiles();
            }

          }
          break;

      }
    });

    canvas.addEventListener('click', (e) => {
        const mouse = this.getCanvasClickPosition(e);

        // now you have local coordinates,
        // which consider a (0,0) origin at the
        // top-left of canvas element
        console.log(mouse);
        console.log(e);

        switch (this.state) {
          case 'menu':
            this.startNewGame();
            break;
          case 'inProgress':
            const tile = getTile(this.current.world, mouse.tile);
            const previouslySelectedUnitId = this.selectedUnitId;
            if (tile.unitId) {
              const unit = getUnitById(this.current.world, tile.unitId);
              unit.selected = true;
              this.selectedUnitId = unit.id;
            }

            this.computeReachableTiles();
            break;
        }
      }
    );

    this.socket = new WebSocket("ws://localhost:3001");

    this.socket.addEventListener('open', (event) => {
      this.state = 'menu';
      console.log(this.state);
      this.startNewGame();
    });

    this.socket.addEventListener('message', (event) => {
      try {
        console.log(event);
        const messageObject = JSON.parse(event.data);
        console.log('New message:');
        console.log(messageObject);
        switch (messageObject.type) {
          case 'newGameResponse':
            this.current = messageObject.game;
            this.state = 'inProgress';

            const tileMap = this.current.world.tileMap;
            this.mapWidthInTiles = tileMap.length;
            this.mapHeightInTiles = tileMap[0].length;
            this.tileWidth = this.canvas.width / this.mapWidthInTiles;
            this.tileHeight = this.canvas.height / this.mapHeightInTiles;
            break;
          case 'moveResponse':
            break;
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  computeReachableTiles() {
    for (let x = 0; x < this.mapWidthInTiles; x++) {
      for (let y = 0; y < this.mapHeightInTiles; y++) {
        const tile = getTile(this.current.world, {x, y});
        tile.reachable = false;
        delete tile.walkingDistance;
      }
    }
    if (this.selectedUnitId != null) {
      const unit = getUnitById(this.current.world, this.selectedUnitId);
      const unitPosition = unit.position;
      const startingTile = getTile(this.current.world, unitPosition);
      startingTile.walkingDistance = 0;
      startingTile.reachable = false;
      const queue = [startingTile];
      while (queue.length > 0) {
        const tile = queue.pop();
        const walkingDistance = tile.walkingDistance + 1;
        if (walkingDistance > unitTypes[unit.type].move) {
          continue;
        }
        const minX = Math.max(tile.position.x - 1, 0);
        const minY = Math.max(tile.position.y - 1, 0);
        const maxX = Math.min(tile.position.x + 1, this.mapWidthInTiles - 1);
        const maxY = Math.min(tile.position.y + 1, this.mapHeightInTiles - 1);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            if (x === unitPosition.x && y === unitPosition.y) {
              continue;
            }
            const targetTile = getTile(this.current.world, {x, y});
            if (targetTile.type !== 'mountain') {
              if (targetTile.reachable === false) {
                targetTile.reachable = true;
                targetTile.walkingDistance = walkingDistance;
                queue.push(targetTile);
              } else if (walkingDistance < targetTile.walkingDistance) {
                targetTile.walkingDistance = walkingDistance;
                queue.push(targetTile);
              }
            }
          }
        }
      }
    }
  }

  getCanvasClickPosition(e) {
    // use pageX and pageY to get the mouse position
    // relative to the browser window
    const x = e.pageX - this.canvasPosition.x;
    const y = e.pageY - this.canvasPosition.y;
    const mouse = {
      pixel: {
        x,
        y,
      },
      tile: {
        x: Math.floor(x / this.tileWidth),
        y: Math.floor(y / this.tileHeight),
      },
    }
    return mouse;
  }

  startNewGame() {
    this.send({
      type: 'newGameRequest',
    });
  }

  send(o) {
    this.socket.send(JSON.stringify(o));
  }

  tick() {
    // clear
    this.context.fillStyle = '#000000'
    this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height)

    switch (this.state) {
      case 'loading':
        break;
      case 'menu':
        this.context.fillStyle = 'red'
        this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height)

        break;
      case 'inProgress':
        const world = this.current.world;
        const tileMap = world.tileMap;
        const unitOffset = 2;
        const unitWidth = this.tileWidth - (unitOffset * 2);
        const unitHeight = this.tileHeight - (unitOffset * 2);
        for (let x = 0; x < this.mapWidthInTiles; x++) {
          for (let y = 0; y < this.mapHeightInTiles; y++) {
            const tile = tileMap[x][y];
            let color = {
              'forest': '#2d7f4e',
              'forestWithBerries': '#8bb14d',
              'forestWithGame': '#46a17a',
              'mountain': '#745c0d',
              'mountainWithGold': '#fcf505',
              'mountainWithIron': '#b6b6b6',
              'mountainWithStones': '#ce9e9e',
              'hill': '#ffffff',
              'plain': '#c2ffbe',
              'settler': '#f868b2',
              'warrior': '#ff0000',
            }
            this.context.fillStyle = color[tile.type];

            const xPos = x * this.tileWidth;
            const yPos = y * this.tileHeight;
            this.context.fillRect(xPos, yPos, this.tileWidth, this.tileHeight);
            if (tile.reachable) {
              this.context.fillStyle = 'black';
              this.context.fillRect(xPos, yPos, this.tileWidth, this.tileHeight);
            }

            if (tile.unitId) {
              const unit = world.units[tile.unitId];
              {
                const unitXPos = tile.position.x * this.tileWidth + unitOffset;
                const unitYPos = tile.position.y * this.tileHeight + unitOffset;

                this.context.fillStyle = color[unit.type];
                this.context.fillRect(unitXPos, unitYPos, unitWidth, unitHeight);
              }
            }
          }
        }

        break;
    }
  }

  run() {
    setInterval(() => {
      this.tick();
    }, 100);
  }
}


export function GamePage(props) {

  useEffect(() => {
    const canvas = canvasRef.current;
    console.log(canvas);
    const game = new Game(canvas);
    game.run();

  }, [])

  const canvasRef = useRef(null);

  return <div className="Game">
    <canvas id="canvas" width="300" height="300" ref={canvasRef}>

    </canvas>
  </div>
}
