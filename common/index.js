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

function newCity() {
  return {
    id: uuid.v4(),
  };
}

function newUnit(world, type) {
  const unit = {
    id: uuid.v4(),
    type,
    hitPoints: unitTypes[type].baseHitPoints,
  };
  world.units[unit.id] = unit;
  return unit;
}

function moveUnitToTile(world, unit, tile) {
  if (unit.position != null) {
    const originalTile = getTile(world, unit.position);
    originalTile.unitId = null;
  }
  tile.unitId = unit.id;
  unit.position = tile.position;
}

function getUnitById(world, unitId) {
  const unit = world.units[unitId];
  return unit;
}

function getTile(world, tileCoord) {
  const tile = world.tileMap[tileCoord.x][tileCoord.y];
  return tile;
}


function addUnitToPlayer(unit, player) {
  player.units.push(unit);
  unit.owner = player.id;
}

module.exports = {
  newCity,
  newUnit,
  moveUnitToTile,
  addUnitToPlayer,
  unitTypes,
  getUnitById,
  getTile,
};
