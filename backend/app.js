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
const {
  Game,
  unitTypes,
  ErrorResponse,
} = require('4xgame_common');

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
  const ws = connectedPlayers[request.session.userId];

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

const games = {};
const connectedPlayers = {};
const sockets = {};

function addPlayerToGame(game, player) {
  game.players.push(player);
  const startingTile = game.getRandomTile();
  const startingSettler = game.newUnit('settler');
  game.moveUnitToTile(startingSettler, startingTile);
  game.addUnitToPlayer(startingSettler, player);
  player.currentGameId = game.id;
}

wss.on('connection', function (ws, request) {
  const playerId = request.session.userId;

  const player = {
    id: playerId,
    unitIds: [],
    cityIds: [],
    buildingIds: [],
  };
  connectedPlayers[playerId] = player;
  sockets[playerId] = ws;
  const send = (socket, o) => {
    ws.send(JSON.stringify(o));
  };

  const sendToOtherPlayers = (o) => {
    const game = games[player.currentGameId];
    for (const otherPlayer of game.players) {
      if (otherPlayer.id === player.id) {
        continue;
      }
      const socket = sockets[otherPlayer.id];
      if (socket) {
        socket.send(socket, {
          type: 'otherPlayerTurnResponse',
          playerId: player.id,
          commands: messageObject.commands,
        });
      } else {
        sockets[otherPlayer.id] = undefined;
      }
    }
  }

  ws.on('message', function (message) {
    //
    // Here we can now use session parameters.
    //
    try {
      const messageObject = JSON.parse(message);
      switch (messageObject.type) {
        case 'gameListRequest':
          const gameSummaries = [];
          for (const gameId in games) {
            const game = games[gameId];
            gameSummaries.push({
              id: game.id,
              players: game.players.length,
            });
          }
          send(ws, {
            type: 'gameListResponse',
            gameSummaries,
          });
          break;
        case 'newGameRequest': {
          const game = Game.createWithRandomWorld();
          addPlayerToGame(game, player);

          games[game.id] = game;
          send(ws, {
            type: 'newGameResponse',
            game,
            player,
          });
        }

          break;
        case 'joinGameRequest': {
          const gameId = messageObject.gameId;
          const game = games[gameId];
          if (game == null) {
            send(ws, {
              type: 'joinGameResponse',
              error: ErrorResponse.gameDoesNotExist,
            });
            return;
          }
          addPlayerToGame(game, player);

          send(ws, {
            type: 'joinGameResponse',
            game,
            player,
          });
        }
          break;
        case 'readyRequest':
          player.ready = true;
          break;
        case 'endTurnRequest':
          // TODO: input validation
          // if input is invalid, ban the player
          const game = games[player.currentGameId];
          for (const command of messageObject.commands) {
            switch (command.type) {
              case 'move':
                const movingUnit = this.current.getUnitById(command.unitId);
                const path = command.path.map(tileId => game.getTileById(tileId));
                for (const tile of path) {
                  if (movingUnit.move <= 0) {
                    break;
                  }
                  if (tile.type === 'mountain') {
                    continue;
                  }
                  game.moveUnitToTile(movingUnit, tile);
                  movingUnit.move--;
                }
                break;
            }
          }
          for (const unitId of player.unitIds) {
            const unit = game.units[unitId];
            unit.move = unitTypes[unit.type].move;
          }
          for (const otherPlayer of game.players) {
            if (otherPlayer.id === player.id) {
              continue;
            }
            const socket = sockets[otherPlayer.id];
            if (socket) {
              socket.send(socket, {
                type: 'otherPlayerTurnResponse',
                playerId: player.id,
                commands: messageObject.commands,
              });
            } else {
              delete sockets[otherPlayer.id];
            }
          }
          break;
      }
      console.log(`Received message ${message}`);
    } catch (e) {
      console.error(e);
    }
  });

  ws.on('close', function () {
    if (player.currentGameId != null) {
      const game = games[player.currentGameId];
      if (game != null) {
        const playerIndex = game.players.findIndex(p => p === player);
        game.players.splice(playerIndex, 1);
        if (game.players.length == 0) {
          delete games[player.currentGameId];
        }
      }
      player.currentGameId = undefined;
    }
    delete connectedPlayers[playerId];
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
