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

var gpClicker;

class Director {
    constructor(actor) {
        this.actor = actor;

        // When the Actor which I am directing is
        // disposed, I should dispose myself too.
        var me = this;
        class DeathObserver {
            dispose() {
                me.dispose();
            }
        }
        actor.addObserver(new DeathObserver());
    }
}

class RoboticDirector extends Director {
    constructor(actor) {
        super(actor);
        actor.orientTowards(actor.choosePassage());

        actor.representation.setAnimationFinishedCallback(this.animationFinished.bind(this));
    }

    dispose() {
    }

    static flipCoin() {
        return Math.floor(Math.random()*2);
    }

    // Chooses a direction by considering all possibilities and
    // giving a bias towards moving forwards.
    chooseDirection() {
        var canGoStraight = this.actor.canWalk(this.actor.facing);
        var canGoLeft     = this.actor.canWalk(Directions.leftFrom(this.actor.facing));
        var canGoRight    = this.actor.canWalk(Directions.rightFrom(this.actor.facing));

        // 1:1 odds of going straight if there is the possibility to turn.
        if(canGoStraight && (!(canGoLeft || canGoRight) || RoboticDirector.flipCoin())) {
            return this.actor.facing;
        }

        // 1:1 odds of going left or right, or about-face if no other choice.
        if(RoboticDirector.flipCoin()) {
            // Try to go right, then left, then reverse
            if(canGoRight) {
                return Directions.rightFrom(this.actor.facing);
            } else if(canGoLeft) {
                return Directions.leftFrom(this.actor.facing);
            } else {
                return Directions.oppositeFrom(this.actor.facing);
            }
        } else {
            // Try to go left, then right, then reverse
            if(canGoLeft) {
                return Directions.leftFrom(this.actor.facing);
            } else if(canGoRight) {
                return Directions.rightFrom(this.actor.facing);
            } else {
                return Directions.oppositeFrom(this.actor.facing);
            }
        }
    }

    shootIfTargetInRange() {
        var target = this.actor.actorInFrontOfMe;
        if(target) {
            this.actor.shoot();
        }
    }

    animationFinished() {
        if(this.actor.isDead) {
            return;
        }

        if(typeof mwDebug !== "undefined") {
            // Check to make sure the WebGL representation
            // is kept in sync with the state of the actors.
            this.actor.representation.assertPosition(this.actor.x, this.actor.z);
        }

        var direction = this.chooseDirection();
        if(direction == this.actor.facing) {
            this.actor.walk(direction);
            this.shootIfTargetInRange();
        } else {
            this.actor.turnTowards(direction);
        }
    }
}

class KeyboardDirector extends Director {
    constructor(actor) {
        super(actor);
        this.listener = this.keypressEvent.bind(this);
        window.addEventListener('keypress', this.listener);
    }

    dispose() {
        window.removeEventListener('keypress', this.listener);
    }

    keypressEvent(e) {
        switch(String.fromCharCode(e.charCode)) {
            case 'a':
                this.actor.aboutFace();
                break;
            case 's':
                this.actor.turnLeft();
                break;
            case 'd':
                this.actor.walk();
                break;
            case 'f':
                this.actor.turnRight();
                break;
            case 'c':
                this.actor.walkBackwards();
                break;
            case ' ':
                this.actor.shoot();
                break;
        }
    }
}

var headsetDirector;

/* Pointer Lock API Support (very useful for games that rely on relative mouse positioning) */

function requestPointerLock(element) {
    element.requestPointerLock = element.requestPointerLock ||
                                 element.mozRequestPointerLock ||
                                 element.webkitRequestPointerLock;
    // Ask the browser to lock the pointer
    if(element.requestPointerLock) {
        element.requestPointerLock();
    }
}

function isPointerLocked() {
    return document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
}

class HeadsetDirector extends Director {
    constructor(actor, container) {
        super(actor);

        this.pressDelay = 200;
        this.pressTimer = null;

        var useTouch = false;
        var me = this;

        this.mousedownFunc  = function(e) {
            if(!isPointerLocked()) {
                requestPointerLock(container);
            }
            if(!useTouch)  me.triggerPressed(e);
        };
        this.mouseupFunc    = function(e) {if(!useTouch)  me.triggerReleased(e);};
        this.touchStartFunc = function(e) {useTouch=true; me.triggerPressed(e);};
        this.touchEndFunc   = function(e) {useTouch=true; me.triggerReleased(e);};

        container.addEventListener('mousedown',  this.mousedownFunc);
        container.addEventListener('mouseup',    this.mouseupFunc);
        container.addEventListener('touchstart', this.touchStartFunc);
        container.addEventListener('touchend',   this.touchEndFunc);

        this.autoWalk = false;
        actor.representation.setAnimationFinishedCallback(this.animationFinished.bind(this));

        headsetDirector = this;

        if(!gpClicker) {
            // Create an object for monitoring the gamepad controllers
            gpClicker = new GamePadControllerWithTimer(this.triggerPressed.bind(this), this.triggerReleased.bind(this));
        }
    }

    dispose() {
        container.removeEventListener('mousedown',  this.mousedownFunc);
        container.removeEventListener('mouseup',    this.mouseupFunc);
        container.removeEventListener('touchstart', this.touchStartFunc);
        container.removeEventListener('touchend',   this.touchEndFunc);

        this.rigidBody = null;

        this.mousedownFunc = null;
        this.mouseupFunc = null;
        this.touchStartFunc = null;
        this.touchEndFunc = null;
        if(this.pressTimer) {
            window.clearTimeout(this.pressTimer);
        }
        headsetDirector = null;

        gpClicker.dispose();
        gpClicker = null;
    }

    triggerHeld() {
        this.setAutoWalk(true);
    }

    triggerTap() {
        this.actor.shoot();
    }

    triggerPressed(e) {
        if(!this.pressTimer) {
            this.pressTimer = window.setTimeout(function() {
                this.pressTimer = null; this.triggerHeld();
            }.bind(this), this.pressDelay);
        }
    }

    triggerReleased(e) {
        if(this.pressTimer) {
            window.clearTimeout(this.pressTimer);
            this.triggerTap();
            this.pressTimer = null;
        } else {
            this.setAutoWalk(false);
        }
    }

    animationFinished() {
        if(this.autoWalk && !this.actor.isDead) {
            this.actor.walk(this.actor.representation.cardinalDirection);
        }
    }

    setAutoWalk(state) {
        this.autoWalk = state;
        if(this.actor.representation.isStopped) {
            this.actor.walk(this.actor.representation.cardinalDirection);
        }
    }

    update(dt) {
        var cardinalDirection = this.actor.representation.cardinalDirection;
        if(cardinalDirection !== this.lastDirection) {
            this.actor.orientTowards(cardinalDirection);
            this.lastDirection = cardinalDirection;

            if(this.autoWalk && this.actor.representation.isStopped) {
                // Walk in new direction if trigger is being held
                this.animationFinished();
            }
        }
        gpClicker.poll();
    }
}