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

// Keeps track of the various actors
class Actors {
    constructor() {
        this.actors = [];
    }
    
    add(actor) {
        this.actors.push(actor);
        return actor;
    }
    
    remove(actor) {
        var index = this.actors.indexOf(actor);
        if (index > -1) {
            this.actors.splice(index, 1);
        }
        actor.dispose();
    }

    removeAll() {
        console.log("Removing all actors");
        while(this.actors.length) {
            this.remove(this.actors[this.actors.length-1]);
        }
    }
    
    isOccupied(x, z, except) {
        for(var i = 0; i < this.actors.length; i++) {
            if((this.actors[i] !== except) && (this.actors[i].x) === x && (this.actors[i].z === z)) {
                return this.actors[i];
            }
        }
    }

    placePlayer(player) {
        player.setPosition(maze.getRandomPosition());
        player.orientTowardsPassage();
        player.startAnimation();
        this.add(player);
    }
};

// Actors are anything that has a position within the maze.
class Actor {
    constructor(representation) {
        this.x = 1;
        this.z = 1;
        this.facing = Directions.NORTH;
        this.observers = [];
        this.representation = representation;

        this.addObserver(representation);
    }

    dispose() {
        this.notifyObservers("dispose");
        this.observers.length = 0;
        this.representation.dispose();
        this.representation = null;
    }

    addObserver(observer) {
        this.observers.push(observer);
    }

    notifyObservers(method, ...args) {
        for(var i = 0; i < this.observers.length; i++) {
            if(this.observers[i][method]) {
                this.observers[i][method].apply(this.observers[i], args);
            }
        }
    }

    setPosition(x, z) {
        if(Array.isArray(x)) {
            this.setPosition(x[0],x[1]);
            return;
        }
        this.x = x;
        this.z = z;
        this.notifyObservers("setPosition", x, z);
    }

    choosePassage() {
        var dir = Directions.fromInteger(Math.floor(Math.random() * 4));
        while(!this.canWalk(dir)) {
            dir = Directions.rightFrom(dir);
        }
        return dir;
    }

    canWalk(direction) {
        return maze.canMoveFrom(this.x, this.z, direction);
    }

    /* Movement in the indicated direction */
    walk(direction) {
        direction = direction || this.facing;

        if(!this.canWalk(direction)) {
            return false;
        }
        Directions.updateCoordinates(this, direction);
        this.notifyObservers("walkTo", this.x, this.z, direction);
        return true;
    }

    orientTowards(direction) {
        this.facing = direction;
        this.notifyObservers("orientTowards", direction);
    }

    orientTowardsPassage() {
        this.orientTowards(this.choosePassage());
    }

    turnTowards(direction) {
        this.facing = direction;
        this.notifyObservers("turnTowards", direction);
    }

    startAnimation() {
        this.notifyObservers("startAnimation");
    }

    turnRight() {
        this.turnTowards(Directions.rightFrom(this.facing));
    }

    turnLeft() {
        this.turnTowards(Directions.leftFrom(this.facing));
    }

    aboutFace() {
        this.turnTowards(Directions.oppositeFrom(this.facing));
    }

    walkBackwards() {
        this.walk(Directions.oppositeFrom(this.facing));
    }

    get actorInFrontOfMe() {
        var pos = {x: this.x, z: this.z};
        while(maze.canMoveFrom(pos.x, pos.z, this.facing)) {
            Directions.updateCoordinates(pos, this.facing);
            var which = actors.isOccupied(pos.x, pos.z, this);
            if(which) {
                return which;
            }
        }
        return null;
    }
};

class MissileActor extends Actor {
    constructor(representation, fromPlayer, data) {
        super(representation)
        this.x      = fromPlayer.x;
        this.z      = fromPlayer.z;
        this.facing = fromPlayer.representation.cardinalDirection;
        this.data   = data;

        this.ricochet = false;

        super.setPosition(this.x, this.z);
        this.orientTowards(this.facing);

        representation.setAnimationFinishedCallback(this.animationFinished.bind(this));
    }

    dispose() {
        this.data = null;
    }

    explode() {
        actors.remove(this);
    }

    animationFinished() {
        if(this.canWalk(this.facing)) {
            // Keep moving the missle along until it hits a wall
            this.walk(this.facing);

            // Did I collide with something?
            var hit = actors.isOccupied(this.x, this.z, this);
            if(hit && hit.wasHit && !hit.isDead) {
                hit.wasHit(this.data);
                this.explode();
            }
        } else {
            if(this.ricochet) {
                this.ricochet = false;
                this.facing = Directions.oppositeFrom(this.facing);
                this.orientTowards(this.facing);
                this.walk(this.facing);
            } else {
                this.explode();
            }
        }
    }

    wasHit() {
        this.explode();
    }
}

class Player extends Actor {
    constructor(representation) {
        super(representation);
        this.isDead      = false;
        this.myName      = "no name";
        this.localPlayer = false;

        // The player always sees enemy missiles as yellow-red.
        // The player always sees its own missiles as green.
        this.enemyMissileColor = 0xFF0000 + (Math.floor(Math.random()*256) << 8);
        this.selfMissileColor  = 0x00FF00;
    }

    get missileColor() {
        return this.isSelf ? this.selfMissileColor : this.enemyMissileColor;
    }

    shoot() {
        this.notifyObservers("shoot");

        var facing = this.representation.cardinalDirection;
        var missileRep = this.representation.getMissileRepresentation(this.missileColor);
        var missile = new MissileActor(missileRep, this, {shotBy: this});
        missile.startAnimation();
        return actors.add(missile);
    }

    wasHit(data) {
        if(this.isDead) {
            return;
        }
        this.notifyObservers("wasHit", data.shotBy);
        if(this.localPlayer) {
            // When localPlayer is true, the player will shotDead when
            // it is hit. Remote players are shot only upon receipt of
            // a ratDead packet.
            this.shotDead(data.shotBy);
        }
    }

    shotDead(killedBy) {
        this.isDead = true;
        this.notifyObservers("shotDead", () => {this.respawn()});
    }

    respawn() {
        if(this.localPlayer) {
            // Only the local player has the responsibility of
            // choosing a new position when respawning
            this.setPosition(maze.getRandomPosition());
            this.orientTowardsPassage();
        }
        this.isDead = false;
        this.notifyObservers("respawn");
    }

    set name(name) {
        this.representation.name = name;
        this.myName = name;
    }

    get name() {
        return this.myName;
    }

    setLocalPlayer(isSelf) {
        this.localPlayer = true;
        this.isSelf      = isSelf;
    }
}