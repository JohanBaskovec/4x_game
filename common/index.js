const uuid = require('uuid');

const unitTypes = {
  settler: {
    move: 2,
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
    for (let x = 0; x < 10; x++) {
      tileMap[x] = [];
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
      }
    }

    const game = Game.fromData({
      id: uuid.v4(),
      users: [],
      tileMap,
      units: {},
      cities: {},
      buildings: {},
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
    };
    this.units[unit.id] = unit;
    return unit;
  }

  moveUnitToTile(unit, tile) {
    if (unit.position != null) {
      const originalTile = this.getTile(unit.position);
      originalTile.unitId = null;
    }
    tile.unitId = unit.id;
    unit.position = tile.position;
  }

  getUnitById(unitId) {
    return this.units[unitId];
  }

  getTile(tileCoord) {
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
}

module.exports = {
  unitTypes,
  Game,
};
