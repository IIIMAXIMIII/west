import Card from './Card.js';
import Game from './Game.js';
import TaskQueue from './TaskQueue.js';
import SpeedRate from './SpeedRate.js';

function getCreatureDescription(card) {
    if (isDuck(card)) return "Утка";
    if (isDog(card)) return "Собака";
    return "Существо";
}

class Creature extends Card {
    getDescriptions() {
        return [getCreatureDescription(this), ...super.getDescriptions()];
    }
}

// Отвечает является ли карта уткой.
function isDuck(card) {
    return card && card.quacks && card.swims;
}

// Отвечает является ли карта собакой.
function isDog(card) {
    return card instanceof Dog;
}

class Duck extends Creature {
    constructor(name = "Мирная утка", maxPower = 2) {
        super(name, maxPower);
    }

    quacks() {
        console.log('Кря!');
    }

    swims() {
        console.log('Плывет!');
    }
}

class Dog extends Creature {
    constructor(name = "Пес-бандит", maxPower = 3) {
        super(name, maxPower);
    }
}

class Trasher extends Dog {
    constructor(name = "Громила", maxPower = 5) {
        super(name, maxPower);
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        this.view.signalAbility(() => {
            continuation(Math.max(value - 1, 0));
        });
    }

    getDescriptions() {
        return ["Получает на 1 меньше урона", ...super.getDescriptions()];
    }
}

class Lad extends Dog {
    constructor(name = "Браток", maxPower = 2) {
        super(name, maxPower);
    }

    static getInGameCount() {
        return this.inGameCount || 0;
    }

    static setInGameCount(value) {
        this.inGameCount = value;
    }

    static getBonus() {
        const count = this.getInGameCount();
        return (count * (count + 1)) / 2;
    }

    doAfterComingIntoPlay(gameContext, continuation) {
        Lad.setInGameCount(Lad.getInGameCount() + 1);
        super.doAfterComingIntoPlay(gameContext, continuation);
    }

    doBeforeRemoving(gameContext, continuation) {
        Lad.setInGameCount(Lad.getInGameCount() - 1);
        super.doBeforeRemoving(gameContext, continuation);
    }

    modifyDealedDamageToCreature(value, toCard, gameContext, continuation) {
        continuation(value + Lad.getBonus());
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        continuation(value - Lad.getBonus());
    }

    getDescriptions() {
        const descriptions = super.getDescriptions();
        if (
            Lad.prototype.hasOwnProperty("modifyDealedDamageToCreature") ||
            Lad.prototype.hasOwnProperty("modifyTakenDamage")
        ) {
            descriptions.unshift("Чем их больше, тем они сильнее!");
        }
        return descriptions;
    }
}

class Gatling extends Creature {
    constructor(maxPower = 6) {
        super('Гатлинг', maxPower);
    }

    attack(gameContext, continuation) {
        const taskQueue = new TaskQueue();

        const {currentPlayer, oppositePlayer, position, updateView} = gameContext;

        taskQueue.push(onDone => this.view.showAttack(onDone));
        oppositePlayer.table.forEach((card, index) => {
            if (card) {
                taskQueue.push(onDone => {
                    this.dealDamageToCreature(2, card, gameContext, onDone);
                });
            }
        });

        taskQueue.continueWith(continuation);
    }
}


class Rogue extends Creature {
    constructor(name = "Изгой", maxPower = 2) {
        super(name, maxPower);
    }

    doBeforeAttack(gameContext, continuation) {
        const { currentPlayer, oppositePlayer, position } = gameContext;

        const oppositeCard = oppositePlayer.table[position];

        if (oppositeCard) {
            this.stealAbilities(oppositeCard, gameContext);
        }
        continuation();
    }

    stealAbilities(targetCard, gameContext) {
        const { currentPlayer, oppositePlayer } = gameContext;

        const targetPrototype = Object.getPrototypeOf(targetCard);

        if (!targetPrototype || Object.getPrototypeOf(targetPrototype) === Creature.prototype) {
            return;
        }

        const abilities = [
            "modifyDealedDamageToCreature",
            "modifyDealedDamageToPlayer",
            "modifyTakenDamage",
        ];

        for (const ability of abilities) {
            if (targetPrototype.hasOwnProperty(ability)) {
                this[ability] = targetPrototype[ability];

                for (const card of [...currentPlayer.table, ...oppositePlayer.table]) {
                    if (Object.getPrototypeOf(card) === targetPrototype) {
                        delete card[ability];
                    }
                }
            }
        }

        gameContext.updateView();
    }

    getDescriptions() {
        return ["Перед атакой крадет способности у карт своего типа", ...super.getDescriptions()];
    }
}

const seriffStartDeck = [
    new Duck(),
    new Rogue(),
];

const banditStartDeck = [
    new Lad(),
    new Lad(),
    new Lad(),
];

// Создание игры.
const game = new Game(seriffStartDeck, banditStartDeck);

// Глобальный объект, позволяющий управлять скоростью всех анимаций.
SpeedRate.set(2);

// Запуск игры.
game.play(false, (winner) => {
    alert('Победил ' + winner.name);
});
