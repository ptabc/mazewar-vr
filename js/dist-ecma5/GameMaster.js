var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
MazeWars VR
Copyright (C) 2016 Marcio Teixeira

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var NetworkTransmitter = function () {
    function NetworkTransmitter(network, networkedGame, myId) {
        _classCallCheck(this, NetworkTransmitter);

        this.network = network;
        this.ratId = myId;
        this.game = networkedGame;
    }

    _createClass(NetworkTransmitter, [{
        key: "walkTo",
        value: function walkTo(x, z, direction) {
            this.network.setRatPosition(this.ratId, x, z);
        }
    }, {
        key: "setPosition",
        value: function setPosition(x, z) {
            this.network.setRatPosition(this.ratId, x, z);
        }
    }, {
        key: "orientTowards",
        value: function orientTowards(direction) {
            this.network.setRatDirection(this.ratId, Directions.toAltoDir(direction));
        }
    }, {
        key: "turnTowards",
        value: function turnTowards(direction) {
            this.network.setRatDirection(this.ratId, Directions.toAltoDir(direction));
        }
    }, {
        key: "shoot",
        value: function shoot() {
            this.network.ratShoots(this.ratId);
        }
    }, {
        key: "wasHit",
        value: function wasHit(byWhom) {
            var killedBy = this.game.getActorRatId(byWhom);
            this.network.ratKilled(this.ratId, killedBy);
        }
    }]);

    return NetworkTransmitter;
}();

var NetworkedGame = function () {
    function NetworkedGame(playerFactory) {
        _classCallCheck(this, NetworkedGame);

        this.factory = playerFactory;

        this.players = [];
    }

    _createClass(NetworkedGame, [{
        key: "startGame",
        value: function startGame(hostId, playerName, stateChangedCallback) {
            // Create the new players
            this.selfPlayer = this.factory.newSelfPlayer();
            this.selfPlayer.name = playerName;
            this.selfPlayer.setLocalPlayer(true);

            this.waitingForOpponent = true;
            this.stateChangedCallback = stateChangedCallback;

            // Start networking

            var initialPlayer = {
                name: this.selfPlayer.name,
                xLoc: this.selfPlayer.x,
                yLoc: this.selfPlayer.z,
                dir: Directions.toAltoDir(this.selfPlayer.facing)
            };

            this.mazeService = new RetroWeb.PupMazeWarServices(initialPlayer, false);

            this.mazeService.addEventListener("newGame", this.newGameCallback.bind(this));
            this.mazeService.addEventListener("ratUpdate", this.ratUpdateCallback.bind(this));
            this.mazeService.addEventListener("ratKill", this.ratKillCallback.bind(this));
            this.mazeService.addEventListener("ratDead", this.ratDeadCallback.bind(this));
            this.mazeService.addEventListener("ratGone", this.ratGoneCallback.bind(this));

            this.server = new RetroWeb.PupServer();
            this.server.addService(this.mazeService);
            this.server.startServices(hostId, 0, stateChangedCallback);
        }
    }, {
        key: "newGameCallback",
        value: function newGameCallback(myId, rat) {
            console.log("New game, my rat id is", myId);
            this.selfPlayer.addObserver(new NetworkTransmitter(this.mazeService, this, myId));
            this.selfPlayer.name = rat.name;

            if (this.players[myId]) {
                console.log("WARNING: This slot is already occupied");
            } else {
                this.players[myId] = this.selfPlayer;
            }
        }
    }, {
        key: "ratUpdateCallback",
        value: function ratUpdateCallback(ratId, rat) {
            var actor = this.players[ratId];

            if (this.waitingForOpponent) {
                this.stateChangedCallback("opponentAvailable");
                this.waitingForOpponent = false;
            }

            if (!actor) {
                console.log("Creating player", ratId);
                actor = this.factory.newOtherPlayer();
                this.players[ratId] = actor;
                actor.name = rat.name;
            }

            actor.setPosition(rat.xLoc, rat.yLoc);
            actor.orientTowards(Directions.fromAltoDir(rat.dir));
        }
    }, {
        key: "ratKillCallback",
        value: function ratKillCallback(ratId, rat) {
            var actor = this.players[ratId];
            actor.setPosition(rat.xLoc, rat.yLoc);
            actor.orientTowards(Directions.fromAltoDir(rat.dir));
            actor.shoot();
        }
    }, {
        key: "ratDeadCallback",
        value: function ratDeadCallback(ratId, killedBy) {
            var actor = this.players[ratId];
            actor.shotDead(this.players[killedBy]);
        }
    }, {
        key: "ratGoneCallback",
        value: function ratGoneCallback(ratId) {
            var actor = this.players[ratId];
            if (actor) {
                actors.remove(actor);
                actor.dispose();
                this.players[ratId] = null;
            } else {
                console.log("Received ratGone for player which is non-existent");
            }
        }
    }, {
        key: "getActorRatId",
        value: function getActorRatId(actor) {
            for (var ratId = 0; ratId < this.players.length; ratId++) {
                if (this.players[ratId] === actor) {
                    return ratId;
                }
            }
        }
    }, {
        key: "endGame",
        value: function endGame() {
            if (!this.gameEnded) {
                this.gameEnded = true;
                actors.disposeAll();
                this.mazeService.endGame();
            }
        }
    }]);

    return NetworkedGame;
}();

var SoloGame = function () {
    function SoloGame(playerFactory) {
        _classCallCheck(this, SoloGame);

        this.factory = playerFactory;
    }

    _createClass(SoloGame, [{
        key: "startGame",
        value: function startGame() {
            var numberOfRobots = 3;

            var self = this.factory.newSelfPlayer();
            self.setLocalPlayer(true);

            for (var i = 0; i < numberOfRobots; i++) {
                var robot = this.factory.newRobotPlayer();
                robot.setLocalPlayer();
            }
        }
    }, {
        key: "endGame",
        value: function endGame() {
            if (!this.gameEnded) {
                this.gameEnded = true;
                actors.disposeAll();
            }
        }
    }]);

    return SoloGame;
}();