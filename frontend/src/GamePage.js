import React from "react";

const {useEffect} = require("react");

const {useRef} = require("react");

class Game {
  constructor(canvas) {
    const context = canvas.getContext('2d')
    this.state = 'loading';
    this.canvas = canvas;
    this.context = context;
    this.current = null;
    this.orderQueue = [];
    this.selectedUnit = null;

    this.canvasPosition = {
      x: canvas.offsetLeft,
      y: canvas.offsetTop,
    };

    canvas.addEventListener('click', (e) => {

      // use pageX and pageY to get the mouse position
      // relative to the browser window

      const mouse = {
        x: e.pageX - this.canvasPosition.x,
        y: e.pageY - this.canvasPosition.y
      }

      // now you have local coordinates,
      // which consider a (0,0) origin at the
      // top-left of canvas element
      console.log(mouse);

      switch (this.state) {
        case 'menu':
          this.startNewGame();
          break;
        case 'inProgress':
          break;
      }
    });

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
            break;
          case 'moveResponse':
            break;
        }
      } catch (e) {
        console.error(e);
      }
    });
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
        const mapWidthInTiles = tileMap.length;
        const mapHeightInTiles = tileMap[0].length;
        const tileWidth = this.canvas.width / mapWidthInTiles;
        const tileHeight = this.canvas.height / mapHeightInTiles;
        const unitOffset = 2;
        const unitWidth = tileWidth - (unitOffset * 2);
        const unitHeight = tileHeight - (unitOffset * 2);
        for (let x = 0; x < mapWidthInTiles; x++) {
          for (let y = 0; y < mapHeightInTiles; y++) {
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

            const xPos = x * tileWidth;
            const yPos = y * tileHeight;
            this.context.fillRect(xPos, yPos, tileWidth, tileHeight);

            if (tile.unitId) {
              const unit = world.units[tile.unitId];
              {
                const unitXPos = tile.position.x * tileWidth + unitOffset;
                const unitYPos = tile.position.y * tileHeight + unitOffset;

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
