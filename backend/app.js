const express = require('express');
const expressSession = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sassMiddleware = require('node-sass-middleware');
const debug = require('debug')('4xgame:server');
const WebSocket = require('ws');
const http = require('http');
const uuid = require('uuid');
const cors = require('cors');
const unitTypes = require('../common/unitTypes.js');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const app = express();

const sessionParser = expressSession({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionParser);
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(sassMiddleware({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  indentedSyntax: true, // true = .sass and false = .scss
  sourceMap: true
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);

app.post('/login', function (req, res) {
  //
  // "Log in" user and set userId to session.
  //
  const id = uuid.v4();

  console.log(`Updating session for user ${id}`);
  req.session.userId = id;
  console.log(req.sessionID);
  console.log(req.session);
  res.send({
    user: {
      id,
    },
  });
});

app.delete('/logout', function (request, response) {
  const ws = connectedUsers[request.session.userId];

  console.log('Destroying session');
  request.session.destroy(function () {
    if (ws) ws.close();

    response.send({result: 'OK', message: 'Session destroyed'});
  });
});

const port = 3001;
app.set('port', port);
const server = http.createServer(app);
server.on('error', onError);
server.on('listening', onListening);

const wss = new WebSocket.Server({clientTracking: false, noServer: true});

server.on('upgrade', function (request, socket, head) {
  console.log('Parsing session from request...');

  sessionParser(request, {}, () => {
    console.log(request.sessionID);
    console.log(request.session);
    if (!request.session.userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    console.log('Session is parsed!');

    wss.handleUpgrade(request, socket, head, function (ws) {
      wss.emit('connection', ws, request);
    });
  });
});

// max excluded
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * ((max - 1) - min + 1) + min);
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

function getRandomTileType() {
  return tileTypes[getRandomNumber(0, tileTypes.length)];
}

function newWorld() {
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

  return {
    tileMap,
    units: {},
    cities: {},
    buildings: {},
  };
}

function getRandomTilePosition(world) {
  return {
    x: getRandomNumber(0, world.tileMap.length),
    y: getRandomNumber(0, world.tileMap[0].length)
  }
}

function getRandomTile(world) {
  const position = getRandomTilePosition(world);
  return world.tileMap[position.x][position.y];
}

const games = [];
const connectedUsers = {};
const sockets = {};

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

function moveUnitToTile(unit, tile) {
  tile.unitId = unit.id;
  unit.position = tile.position;
}

function addUnitToPlayer(unit, player) {
  player.units.push(unit);
  unit.owner = player.id;
}

wss.on('connection', function (ws, request) {
  const send = (o) => {
    ws.send(JSON.stringify(o));
  };
  const userId = request.session.userId;

  connectedUsers[userId] = {
    id: userId,
    units: [],
    cities: [],
    buildings: [],
  };
  sockets[userId] = ws;

  ws.on('message', function (message) {
    const player = connectedUsers[userId];
    //
    // Here we can now use session parameters.
    //
    try {
      const messageObject = JSON.parse(message);
      switch (messageObject.type) {
        case 'newGameRequest':
          const game = {
            users: [player],
            id: uuid.v4(),
            world: newWorld(),
          };
          const startingTile = getRandomTile(game.world);
          const startingSettler = newUnit(game.world, 'settler');
          moveUnitToTile(startingSettler, startingTile);
          addUnitToPlayer(startingSettler, player);

          games.push(game);
          send({
            type: 'newGameResponse',
            game,
          });

          break;
        case 'moveRequest':
          const movements = messageObject.movements;
          const builds = messageObject.build;
          for (const movement of movements) {
            const targetPosition = movement.targetPosition;
            const unit = movement.unitPosition;
          }
          for (const build of builds) {
            const targetPosition = build.position;
            const buildingType = build.buildingType;
          }

          break;
      }
      console.log(`Received message ${message}`);
    } catch (e) {
      console.error(e);
    }
  });

  ws.on('close', function () {
    delete connectedUsers[userId];
  });
});

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

server.listen(port);
