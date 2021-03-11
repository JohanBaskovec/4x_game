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

const games = [];
const connectedUsers = {};
const sockets = {};

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
          const game = Game.createWithRandomWorld();
          game.users.push(player);
          const startingTile = game.getRandomTile();
          const startingSettler = game.newUnit('settler');
          game.moveUnitToTile(startingSettler, startingTile);
          game.addUnitToPlayer(startingSettler, player);

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
