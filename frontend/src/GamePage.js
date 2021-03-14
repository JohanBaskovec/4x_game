import React from "react";

const {useEffect} = require("react");

const {useRef} = require("react");
const {
  Game,
  unitTypes,
  ErrorResponse,
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
    this.commandsForServer = [];
    this.commandQueue = [];
    this.selectedUnitId = null;
    this.gameSummaries = [];
    this.leafNodes = [];

    this.canvasPosition = {
      x: canvas.offsetLeft,
      y: canvas.offsetTop,
    };
    this.mainMenu = {
      width: '100%',
      height: '100%',
      backgroundColor: 'green',
      centerHorizontally: true,
      onClick: () => {
        console.log('on click on canvas root node!');
      },
      children: [
        {
          type: 'text',
          text: '4x Game',
          font: '48px serif',
          fillStyle: 'black',
          marginTop: 50,
          onClick: () => {
            console.log('on click on title!');
          },
        },
        {
          type: 'button',
          backgroundColor: 'red',
          width: '80%',
          height: 80,
          marginTop: 10,
          centerHorizontally: true,
          centerVertically: true,
          children: [
            {
              type: 'text',
              font: '48px serif',
              fillStyle: 'black',
              text: 'New game',
              onClick: () => {
                console.log('on click on new game text!');
              },
            }
          ],
          onClick: () => {
            this.startNewGame();
          },
        }
      ]
    };
    this.canvasNode = {
      width: this.canvas.width,
      height: this.canvas.height,
      computedWidth: this.canvas.width,
      computedHeight: this.canvas.height,
      y: 0,
      x: 0,
    };
    this.gameUi = {
      width: '100%',
      height: '100%',
      backgroundColor: 'green',
      onClick: () => {
        console.log('on click on canvas root node!');
      },
      children: [
        {
          position: 'fixed',
          type: 'div',
          backgroundColor: 'red',
          width: '100%',
          height: 80,
          bottom: 0,
          centerHorizontally: true,
          centerVertically: true,
          children: [
            {
              type: 'button',
              width: 250,
              height: "100%",
              backgroundColor: 'white',
              centerHorizontally: true,
              centerVertically: true,
              children: [
                {
                  type: 'text',
                  font: '48px serif',
                  fillStyle: 'black',
                  text: 'Next turn',
                }
              ]
            }
          ],
          onClick: () => {
            this.nextTurn();
          },
        }
      ]
    };
    this.lobbyUi = {
      width: '100%',
      height: '100%',
      backgroundColor: 'green',
      centerHorizontally: true,
      children: [
        {
          type: 'div',
          backgroundColor: 'yellow',
          width: '80%',
          marginTop: 10,
          centerHorizontally: true,
          id: 'playerNames',
          children: [],
        },
        {
          type: 'button',
          backgroundColor: 'red',
          width: '80%',
          height: 80,
          marginTop: 10,
          centerHorizontally: true,
          centerVertically: true,
          children: [
            {
              type: 'text',
              font: '48px serif',
              fillStyle: 'black',
              text: 'Start game',
              onClick: () => {
                this.startGame();
              },
            }
          ],
          onClick: () => {
            this.startNewGame();
          },
        }
      ],
    }
    this.ui = this.mainMenu;
    this.initNode(this.canvasNode, this.ui, 0);
    this.initNode(this.canvasNode, this.gameUi, 0);
    this.initNode(this.canvasNode, this.lobbyUi, 0);

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
              const path = this.current.findShortestPath(unit, tile);
              const command = this.current.createMoveCommand(unit, path);
              this.commandsForServer.push(command);
              this.commandQueue.push(command);
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

        if (this.ui) {
          function executeOnClick(node, path) {
            let bubble = true;
            if (node.onClick) {
              const ret = node.onClick({
                type: 'click',
                path: path,
              });
              if (ret === false) {
                bubble = false;
              }
            }
            if (!bubble) {
              return;
            }
            if (node.parent) {
              executeOnClick(node.parent);
            }
          }

          function findHit(node, path) {
            let childHit = false;
            if (node.children) {
              for (const child of node.children) {
                if (mouse.pixel.x > child.x && mouse.pixel.x < child.x + child.computedWidth
                  && mouse.pixel.y > child.y && mouse.pixel.y < child.y + child.computedHeight) {
                  findHit(child, path.concat(child));
                  childHit = true;
                  break;
                }
              }
            }
            if (!childHit) {
              executeOnClick(node, path);
            }
          }

          findHit(this.ui, [this.ui]);
        }

        switch (this.state) {
          case 'menu':
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
      this.send({
        type: 'gameListRequest',
      });
      //this.startNewGame();
    });

    this.socket.addEventListener('message', (event) => {
      (async () => {
        try {
          console.log(event);
          const messageObject = JSON.parse(event.data);
          console.log('New message:');
          console.log(messageObject);
          switch (messageObject.type) {
            case 'gameListResponse':
              this.gameSummaries = messageObject.gameSummaries;
              for (const gameSummary of this.gameSummaries) {
                this.addNode(
                  this.mainMenu,
                  {
                    type: 'button',
                    backgroundColor: 'orange',
                    width: '80%',
                    height: 80,
                    marginTop: 10,
                    centerHorizontally: true,
                    centerVertically: true,
                    children: [
                      {
                        type: 'text',
                        font: '48px serif',
                        fillStyle: 'black',
                        text: gameSummary.id,
                        onClick: () => {
                          console.log('click on game text');
                        }
                      }
                    ],
                    onClick: () => {
                      this.clickOnGame(gameSummary);
                    },
                  }
                );
              }
              break;
            case 'newGameResponse':
              this.current = Game.fromData(messageObject.game);
              this.state = 'lobby';
              this.ui = this.lobbyUi;
              const playerNamesNode = this.getById('playerNames');
              for (const player of this.current.players) {
                this.addNode(playerNamesNode, {
                  type: 'div',
                  backgroundColor: 'black',
                  width: '100%',
                  height: 80,
                  centerHorizontally: true,
                  centerVertically: true,
                  children: [
                    {
                      type: 'text',
                      font: '48px serif',
                      fillStyle: 'white',
                      text: player.id,
                    }
                  ]
                });
              }
              this.player = messageObject.player;
              this.tileWidth = this.canvas.width / this.current.mapWidthInTiles;
              this.tileHeight = this.canvas.height / this.current.mapHeightInTiles;
              break;
            case 'otherPlayerTurnResponse':
              const commands = messageObject.commands;
              this.commandQueue = commands;
              break;
            case 'joinGameResponse': {
              this.player = messageObject.player;
              this.current = Game.fromData(messageObject.game);
              this.state = 'lobby';
              this.ui = this.lobbyUi;
              const playerNamesNode = this.getById('playerNames');
              for (const player of this.current.players) {
                this.addNode(playerNamesNode, {
                  type: 'div',
                  backgroundColor: 'black',
                  width: '100%',
                  height: 80,
                  centerHorizontally: true,
                  centerVertically: true,
                  children: [
                    {
                      type: 'text',
                      font: '48px serif',
                      fillStyle: 'white',
                      text: player.id,
                    }
                  ]
                });
              }
            }
              break;
          }
        } catch (e) {
          console.error(e);
        }
      })();
    });
  }

  createNode(type) {
    return {
      type,
      children: [],
    };
  }

  getById(id, node) {
    if (node == null) {
      node = this.ui;
    }
    if (node.id === id) {
      return node;
    }
    for (const child of node.children) {
      const node = this.getById(id, child);
      if (node != null) {
        return node;
      }
    }
  }

  ready() {
    this.send({
      type: 'readyRequest',
    });
  }

  startGame() {
    this.send({
      type: 'startGameRequest',
    });
  }

  nextTurn() {
    this.send({
      type: 'endTurnRequest',
      commands: this.commandsForServer,
    });
  }

  executeCommand(command) {
    command.state = 'inProgress';
    switch (command.type) {
      case 'move':
        const unit = this.current.getUnitById(command.unitId);
        const path = command.path.map(tileId => this.current.getTileById(tileId));
        unit.movement = {
          path: path,
          currentStep: 0,
          state: 'begin',
        };
        break;
    }
  }

  computeReachableTiles() {
    for (const tileId in this.current.tiles) {
      const tile = this.current.tiles[tileId];
      tile.reachable = false;
      delete tile.walkingDistance;
    }
    if (this.selectedUnitId != null) {
      const unit = this.current.getUnitById(this.selectedUnitId);
      const unitPosition = unit.position;
      const startingTile = this.current.getUnitById(this.selectedUnitId);
      startingTile.walkingDistance = 0;
      startingTile.reachable = false;
      const queue = [startingTile];
      while (queue.length > 0) {
        const tile = queue.pop();
        const walkingDistance = tile.walkingDistance + 1;
        if (walkingDistance > unit.move) {
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

  convertSizePercentage(size, parentComputedSize) {
    if (size === undefined) {
      return 0;
    }
    if (typeof size === 'number') {
      return size;
    } else {
      const indexOfPercent = size.indexOf('%');
      if (indexOfPercent !== -1) {
        const percentString = size.substring(0, indexOfPercent);
        const percent = Number.parseFloat(percentString) / 100;
        return parentComputedSize * percent;
      }
    }
  }

  changeParentHeight(parent, n) {
    if (parent.height === undefined) {
      parent.computedHeight += n;
    }
    if (parent.parent != null) {
      this.changeParentHeight(parent.parent, n);
    }
  }

  changeParentWidth(parent, n) {
    if (parent.width === undefined) {
      parent.computedWidth += n;
    }
    if (parent.parent != null) {
      this.changeParentWidth(parent.parent, n);
    }
  }

  initNode(parent, element, index, root) {
    if (root == null) {
      element.root = parent;
    } else {
      element.root = root;
    }
    element.parent = parent;
    element.index = index;
    if (element.font) {
      this.context.font = element.font;
    }
    if (element.type === 'text') {
      const size = this.context.measureText(element.text);
      element.computedHeight = size.actualBoundingBoxAscent + size.actualBoundingBoxDescent;
      element.computedWidth = size.width;
    } else {
      element.computedWidth = this.convertSizePercentage(element.width, parent.computedWidth);
      element.computedHeight = this.convertSizePercentage(element.height, parent.computedHeight);
    }
    this.changeParentHeight(parent, element.computedHeight);
    this.changeParentWidth(parent, element.computedWidth);
    if (element.marginTop === undefined) {
      element.marginTop = 0;
    }

    if (element.position === 'fixed') {
      if (element.right !== undefined) {
        element.x = element.root.computedWidth - element.computedWidth - element.right;
      }
      if (element.bottom !== undefined) {
        element.y = element.root.computedHeight - element.computedHeight - element.bottom;
      }
      if (element.left !== undefined) {
        element.x = element.let;
      }
      if (element.top !== undefined) {
        element.y = element.top;
      }
      if (element.x === undefined) {
        element.x = 0;
      }
      if (element.y === undefined) {
        element.y = 0;
      }
    } else {
      if (element.parent.centerVertically) {
        element.y = parent.y + (parent.computedHeight / 2) - (element.computedHeight / 2) + element.marginTop;
      } else {
        if (index === 0) {
          element.y = parent.y + element.marginTop;
        } else {
          element.y = parent.children[index - 1].y + parent.children[index - 1].computedHeight + element.marginTop;
        }
      }
      if (element.parent.centerHorizontally) {
        element.x = parent.x + (parent.computedWidth / 2) - (element.computedWidth / 2);
      } else {
        element.x = parent.x;
      }
    }

    if (element.children != null) {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        this.initNode(element, child, i, element.root);
      }
    } else {
      this.leafNodes.push(element);
    }
  }

  renderNode(parent, element, index) {
    if (element.font) {
      this.context.font = element.font;
    }
    if (element.fillStyle) {
      this.context.fillStyle = element.fillStyle;
    }

    if (element.backgroundColor) {
      this.context.fillStyle = element.backgroundColor;
      this.context.fillRect(element.x, element.y, element.computedWidth, element.computedHeight);
    }
    if (element.type === 'text') {
      const y = element.y + element.computedHeight;
      this.context.fillText(element.text, element.x, y);
    }

    if (element.children != null) {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        this.renderNode(element, child, i);
      }
    }
  }

  renderUi() {
    this.renderNode(this.canvasNode, this.ui, 0);
  }

  async tick() {
    // clear
    this.context.fillStyle = '#000000'
    this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height)

    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height)

    this.renderUi();

    switch (this.state) {
      case 'loading':
        break;
      case 'menu':

        break;
      case 'inProgress':
        const tileMap = this.current.tileMap;
        const unitOffset = 2;
        const unitWidth = this.tileWidth - (unitOffset * 2);
        const unitHeight = this.tileHeight - (unitOffset * 2);
        for (const tileId in this.current.tiles) {
          const tile = this.current.tiles[tileId];
          this.context.fillStyle = this.color[tile.type];

          const xPos = tile.position.x * this.tileWidth;
          const yPos = tile.position.y * this.tileHeight;
          this.context.fillRect(xPos, yPos, this.tileWidth, this.tileHeight);
          if (tile.reachable) {
            this.context.fillStyle = 'green';
            this.context.globalAlpha = 0.6;
            this.context.fillRect(xPos, yPos, this.tileWidth, this.tileHeight);
            this.context.globalAlpha = 1;
          }

        }

        for (const unitId in this.current.units) {
          const unit = this.current.units[unitId];
          let unitXPos = unit.position.x * this.tileWidth + unitOffset;
          let unitYPos = unit.position.y * this.tileHeight + unitOffset;
          this.context.fillStyle = this.color[unit.type];
          this.context.fillRect(unitXPos, unitYPos, unitWidth, unitHeight);
        }

        if (this.commandQueue[0] && this.commandQueue[0].state === 'inProgress') {
          const command = this.commandQueue[0];
          switch (command.type) {
            case 'move':
              const unit = this.current.getUnitById(command.unitId);
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
                    // noinspection JSConstantReassignment
                    unit.move--;

                    unit.position.x = destination.position.x;
                    unit.position.y = destination.position.y;
                    this.current.unitMap[unit.position.x][unit.position.y] = unit.id;
                    this.computeReachableTiles();
                    if (movement.path.length - 1 < movement.currentStep) {
                      unit.movement = null;
                      command.state = 'done';
                    }
                  }
                }
              }
              break;
          }
        }

        if (this.commandQueue.length > 0) {
          if (this.commandQueue[0].state === 'done') {
            this.commandQueue.splice(0, 1);
          } else if (this.commandQueue[0].state !== 'inProgress') {
            this.executeCommand(this.commandQueue[0]);
          }
        }
    }
  }

  currentCommand() {
    return this.commandQueue[0];
  }

  run() {
    setInterval(() => {
      this.tick();
    }, msPerFrame);
  }

  clickOnGame(gameSummary) {
    console.log('click on online game button');
    this.send({
      type: 'joinGameRequest',
      gameId: gameSummary.id,
    });
  }

  addNode(parent, node) {
    parent.children.push(node);
    this.initNode(parent, node, parent.children.length - 1);
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
    <canvas id="canvas" width="600" height="600" ref={canvasRef}>

    </canvas>
  </div>
}
