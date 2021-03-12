const uuid = require('uuid');

const unitTypes = {
  settler: {
    move: 3,
    defense: 1,
    attack: 0,
    type: 'settler',
    baseHitPoints: 4,
  },
  warrior: {
    move: 1,
    defense: 1,
    attack: 5,
    type: 'warrior',
    baseHitPoints: 10,
  },
}

// max excluded
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * ((max - 1) - min + 1) + min);
}

function getRandomTileType() {
  return tileTypes[getRandomNumber(0, tileTypes.length)];
}


const tileTypes = [
  'forest',
  'forestWithBerries',
  'forestWithGame',
  'mountain',
  'mountainWithGold',
  'mountainWithIron',
  'mountainWithStones',
  'hill',
  'plain',
];

class Game {
  constructor() {
  }

  static createWithRandomWorld() {
    const tileMap = [];
    const unitMap = [];
    for (let x = 0; x < 10; x++) {
      tileMap[x] = [];
      unitMap[x] = [];
      for (let y = 0; y < 10; y++) {
        const tile = {
          type: getRandomTileType(),
          position: {x, y},
          unitId: null,
          city: null,
          building: null,
          id: uuid.v4(),
        };
        tileMap[x][y] = tile;
        unitMap[x][y] = null;
      }
    }

    const game = Game.fromData({
      id: uuid.v4(),
      users: [],
      tileMap,
      units: {},
      unitMap,
      cities: {},
      buildings: {},
      state: 'waitingForPlayers',
    });
    return game;
  }

  static fromData(data) {
    const game = new Game();
    Object.assign(game, data);

    const tileMap = game.tileMap;
    game.mapWidthInTiles = tileMap.length;
    game.mapHeightInTiles = tileMap[0].length;
    return game;
  }

  newCity() {
    return {
      id: uuid.v4(),
    };
  }

  newUnit(type) {
    const unit = {
      id: uuid.v4(),
      type,
      hitPoints: unitTypes[type].baseHitPoints,
      alive: true,
      move: unitTypes[type].move,
    };
    this.units[unit.id] = unit;
    return unit;
  }

  moveUnitToTile(unit, tile) {
    if (unit.position) {
      this.unitMap[unit.position.x][unit.position.y] = null;
    } else {
      unit.position = {x: 0, y: 0};
    }
    unit.position.x = tile.position.x;
    unit.position.y = tile.position.y;
    this.unitMap[unit.position.x][unit.position.y] = unit.id;
  }

  getUnitById(unitId) {
    return this.units[unitId];
  }

  getUnitByPosition(unitCoord) {
    const unitId = this.unitMap[unitCoord.x][unitCoord.y];
    return this.getUnitById(unitId);
  }

  getTileByPosition(tileCoord) {
    return this.tileMap[tileCoord.x][tileCoord.y];
  }

  addUnitToPlayer(unit, player) {
    player.units.push(unit);
    unit.owner = player.id;
  }

  getRandomTilePosition() {
    return {
      x: getRandomNumber(0, this.tileMap.length),
      y: getRandomNumber(0, this.tileMap[0].length)
    }
  }

  getRandomTile() {
    const position = this.getRandomTilePosition();
    return this.tileMap[position.x][position.y];
  }

  findShortestPath(unit, toTile) {
    function h(n) {
      return Math.hypot(toTile.position.x - n.position.x, toTile.position.y - n.position.y);
    }

    this.forEachTile((tile) => {
      tile.fScore = undefined;
      tile.gScore = undefined;
      tile.from = undefined;
    });
    const unitPosition = unit.position;
    const startingTile = this.getTileByPosition(unitPosition);
    startingTile.fScore = h(startingTile);
    startingTile.gScore = 0;

    const queue = [startingTile];
    while (queue.length > 0) {
      let currentTile = null;
      let lowestF = Number.MAX_VALUE;
      let lowestFIndex = 0;
      for (let i = 0; i < queue.length ; i++) {
        const tile = queue[i];
        let fScore = Number.MAX_VALUE;
        if (tile.fScore !== undefined) {
          fScore = tile.fScore;
        }
        if (fScore < lowestF) {
          currentTile = tile;
          lowestF = fScore;
          lowestFIndex = i;
        }
      }
      if (currentTile.position.x === toTile.position.x && currentTile.position.y === toTile.position.y) {
        let step = currentTile;
        const path = [step];
        while (step != null) {
          step = step.from;
          if (step != null && step.from != null) {
            path.push(step);
          }
        }
        return path.reverse();
      }
      queue.splice(lowestFIndex, 1);

      const minX = Math.max(currentTile.position.x - 1, 0);
      const minY = Math.max(currentTile.position.y - 1, 0);
      const maxX = Math.min(currentTile.position.x + 1, this.mapWidthInTiles - 1);
      const maxY = Math.min(currentTile.position.y + 1, this.mapHeightInTiles - 1);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const targetTile = this.getTileByPosition({x, y});
          if (targetTile.type !== 'mountain') {
            let gScoreTarget = Number.MAX_VALUE;
            if (targetTile.gScore !== undefined) {
              gScoreTarget = targetTile.gScore;
            }
            // distance between 2 tiles is always 1
            // TODO: more difficult movement in forest, hills
            const tentativeGScore = currentTile.gScore + 1;
            if (tentativeGScore < gScoreTarget) {
              targetTile.from = currentTile;
              targetTile.gScore = tentativeGScore;
              targetTile.fScore = tentativeGScore + h(targetTile);
              if (queue.find(n => n === targetTile) == null) {
                queue.push(targetTile);
              }
            }
          }
        }
      }
    }
    // no path found
    return null;
  }

  executeCommand(command) {
    switch (command.type) {
      case 'move':
        const unit = this.getUnitByPosition(command.unitPosition);
        const tile = this.getTileByPosition(command.tilePosition);
        if (unit == null || tile == null) {
          return;
        }
        this.moveUnitToTile(unit, tile);
        break;
    }
  }

  createMoveCommand(unit, path) {
    return {
      type: 'move',
      unitPosition: unit.position,
      path: path.map(tile => tile.position),
    };
  }

  forEachTile(f) {
    for (let x = 0; x < this.mapWidthInTiles; x++) {
      for (let y = 0; y < this.mapHeightInTiles; y++) {
        f(this.getTileByPosition({x, y}));
      }
    }
  }
}

module.exports = {
  unitTypes,
  Game,
};
