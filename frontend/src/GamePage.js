import React from "react";

const {useEffect} = require("react");

const {useRef} = require("react");
const {
  Game,
  unitTypes,
} = require('4xgame_common');

const frameRate = 30;
const msPerFrame = 1000 / frameRate;

class CanvasGame {
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
            const unit = this.current.getUnitById(this.selectedUnitId);
            const mouse = this.getCanvasClickPosition(e);
            const tile = this.current.getTileByPosition(mouse.tile);
            if (tile.reachable) {
              // TODO: deselect unit if it's been removed
              const command = this.current.createMoveCommand(unit, tile);
              this.executeCommand(command);
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
            const unit = this.current.getUnitByPosition(mouse.tile);
            if (unit != null) {
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
            this.current = Game.fromData(messageObject.game);
            this.state = 'inProgress';
            this.tileWidth = this.canvas.width / this.current.mapWidthInTiles;
            this.tileHeight = this.canvas.height / this.current.mapHeightInTiles;
            break;
          case 'moveResponse':
            break;
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  executeCommand(command) {
    switch (command.type) {
      case 'move':
        const unit = this.current.getUnitByPosition(command.unitPosition);
        const tile = this.current.getTileByPosition(command.tilePosition);
        const path = this.current.findShortestPath(unit, tile);
        console.log(path);
        unit.movement = {
          path,
          currentStep: 0,
          state: 'begin',
        };
        /*
                      this.current.executeCommand(command);
                      this.commandQueue.push(command);

                      this.current.moveUnitToTile(unit, tile);
        */
        this.computeReachableTiles();
        break;
    }
  }

  computeReachableTiles() {
    for (let x = 0; x < this.current.mapWidthInTiles; x++) {
      for (let y = 0; y < this.current.mapHeightInTiles; y++) {
        const tile = this.current.getTileByPosition({x, y});
        tile.reachable = false;
        delete tile.walkingDistance;
      }
    }
    if (this.selectedUnitId != null) {
      const unit = this.current.getUnitById(this.selectedUnitId);
      const unitPosition = unit.position;
      const startingTile = this.current.getTileByPosition(unitPosition);
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
        const maxX = Math.min(tile.position.x + 1, this.current.mapWidthInTiles - 1);
        const maxY = Math.min(tile.position.y + 1, this.current.mapHeightInTiles - 1);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            if (x === unitPosition.x && y === unitPosition.y) {
              continue;
            }
            const targetTile = this.current.getTileByPosition({x, y});
            if (targetTile.type !== 'mountain') {
              if (targetTile.reachable === false) {
                targetTile.reachable = true;
                targetTile.walkingDistance = walkingDistance;
                targetTile.from = tile;
                queue.push(targetTile);
              } else if (walkingDistance < targetTile.walkingDistance) {
                targetTile.walkingDistance = walkingDistance;
                targetTile.from = tile;
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

  color = {
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
        const tileMap = this.current.tileMap;
        const unitOffset = 2;
        const unitWidth = this.tileWidth - (unitOffset * 2);
        const unitHeight = this.tileHeight - (unitOffset * 2);
        for (let x = 0; x < this.current.mapWidthInTiles; x++) {
          for (let y = 0; y < this.current.mapHeightInTiles; y++) {
            const tile = tileMap[x][y];
            this.context.fillStyle = this.color[tile.type];

            const xPos = x * this.tileWidth;
            const yPos = y * this.tileHeight;
            this.context.fillRect(xPos, yPos, this.tileWidth, this.tileHeight);
            if (tile.reachable) {
              this.context.fillStyle = 'black';
              this.context.globalAlpha = 0.2;
              this.context.fillRect(xPos, yPos, this.tileWidth, this.tileHeight);
              this.context.globalAlpha = 1;
            }

          }
        }

        for (const unitId in this.current.units) {
          const unit = this.current.units[unitId];
          if (unit.movement) {
            const movement = unit.movement;
            const destination = movement.path[movement.currentStep];
            if (movement.state === 'begin') {
              this.current.unitMap[unit.position.x][unit.position.y] = null;
              movement.vec = {
                x: 5 * (destination.position.x - unit.position.x) / frameRate,
                y: 5 * (destination.position.y - unit.position.y) / frameRate,
              };
              movement.state = 'moving';
            }
            if (movement.state === 'moving') {
              unit.position.x += movement.vec.x;
              unit.position.y += movement.vec.y;
              if (movement.vec.x > 0) {
                if (unit.position.x > destination.position.x) {
                  unit.position.x = destination.position.x;
                  unit.movement.vec.x = 0;
                }
              } else {
                if (unit.position.x < destination.position.x) {
                  unit.position.x = destination.position.x;
                  unit.movement.vec.x = 0;
                }
              }
              if (movement.vec.y > 0) {
                if (unit.position.y > destination.position.y) {
                  unit.position.y = destination.position.y;
                  unit.movement.vec.y = 0;
                }
              } else {
                if (unit.position.y < destination.position.y) {
                  unit.position.y = destination.position.y;
                  unit.movement.vec.y = 0;
                }
              }
              if (unit.position.x === destination.position.x
                && unit.position.y === destination.position.y) {
                movement.state = 'begin';
                movement.currentStep++;
                if (movement.path.length - 1 < movement.currentStep) {
                  unit.movement = null;

                  unit.position.x = destination.position.x;
                  unit.position.y = destination.position.y;
                  this.current.unitMap[unit.position.x][unit.position.y] = unit.id;
                  this.computeReachableTiles();
                }
              }
            }
          }

          let unitXPos = unit.position.x * this.tileWidth + unitOffset;
          let unitYPos = unit.position.y * this.tileHeight + unitOffset;
          this.context.fillStyle = this.color[unit.type];
          this.context.fillRect(unitXPos, unitYPos, unitWidth, unitHeight);
        }

        break;
    }
  }

  run() {
    setInterval(() => {
      this.tick();
    }, msPerFrame);
  }
}


export function GamePage(props) {

  useEffect(() => {
    const canvas = canvasRef.current;
    const canvasGame = new CanvasGame(canvas);
    canvasGame.run();
  }, [])

  const canvasRef = useRef(null);

  return <div className="Game">
    <canvas id="canvas" width="300" height="300" ref={canvasRef}>

    </canvas>
  </div>
}
