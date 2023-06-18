window.__require = function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var b = o.split("/");
        b = b[b.length - 1];
        if (!t[b]) {
          var a = "function" == typeof __require && __require;
          if (!u && a) return a(b, !0);
          if (i) return i(b, !0);
          throw new Error("Cannot find module '" + o + "'");
        }
        o = b;
      }
      var f = n[o] = {
        exports: {}
      };
      t[o][0].call(f.exports, function(e) {
        var n = t[o][1][e];
        return s(n || e);
      }, f, f.exports, e, t, n, r);
    }
    return n[o].exports;
  }
  var i = "function" == typeof __require && __require;
  for (var o = 0; o < r.length; o++) s(r[o]);
  return s;
}({
  HotUpdateModule: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "69537HK6VlIYqIdU9HPulDp", "HotUpdateModule");
    "use strict";
    var HotUpdateModule = cc.Class({
      extends: cc.Component,
      properties: {
        manifestUrl: cc.Asset,
        versionLabel: {
          default: null,
          type: cc.Label
        },
        _updating: false,
        _canRetry: false,
        _storagePath: ""
      },
      onLoad: function onLoad() {
        if (!cc.sys.isNative) return;
        this._storagePath = (jsb.fileUtils ? jsb.fileUtils.getWritablePath() : "/") + "client";
        this.versionCompareHandle = function(versionA, versionB) {
          var vA = versionA.split(".");
          var vB = versionB.split(".");
          for (var i = 0; i < vA.length; ++i) {
            var a = parseInt(vA[i]);
            var b = parseInt(vB[i] || 0);
            if (a === b) continue;
            return a - b;
          }
          return vB.length > vA.length ? -1 : 0;
        };
        this._am = new jsb.AssetsManager(this.manifestUrl.nativeUrl, this._storagePath, this.versionCompareHandle);
        this._am.setVerifyCallback(function(filePath, asset) {
          return true;
        });
        this.versionLabel && (this.versionLabel.string = "src:" + this._am.getLocalManifest().getVersion());
        cc.sys.os === cc.sys.OS_ANDROID, this._am.setMaxConcurrentTask(16);
      },
      onDestroy: function onDestroy() {
        if (!cc.sys.isNative) return;
      },
      showLog: function showLog(msg) {
        cc.log("[HotUpdateModule][showLog]----" + msg);
      },
      retry: function retry() {
        if (!this._updating && this._canRetry) {
          this._canRetry = false;
          this._am.downloadFailedAssets();
        }
      },
      updateCallback: function updateCallback(event) {
        var needRestart = false;
        var failed = false;
        switch (event.getEventCode()) {
         case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
          this.showLog("The local manifest file was not found, and the hot update was skipped.");
          failed = true;
          break;

         case jsb.EventAssetsManager.UPDATE_PROGRESSION:
          var percent = event.getPercent();
          if (isNaN(percent)) return;
          var msg = event.getMessage();
          this.disPatchRateEvent(percent, msg);
          this.showLog("updateCallback Update progress:" + percent + ", msg: " + msg);
          break;

         case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
         case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
          this.showLog("Failed to download manifest file, skip hot update.");
          failed = true;
          break;

         case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
          this.showLog("Already the latest version.");
          failed = true;
          break;

         case jsb.EventAssetsManager.UPDATE_FINISHED:
          this.showLog("The update is over." + event.getMessage());
          this.disPatchRateEvent(1);
          needRestart = true;
          break;

         case jsb.EventAssetsManager.UPDATE_FAILED:
          this.showLog("Update error." + event.getMessage());
          this._updating = false;
          this._canRetry = true;
          this._failCount++;
          this.retry();
          break;

         case jsb.EventAssetsManager.ERROR_UPDATING:
          this.showLog("Error during update:" + event.getAssetId() + ", " + event.getMessage());
          break;

         case jsb.EventAssetsManager.ERROR_DECOMPRESS:
          this.showLog("unzip error");
        }
        if (failed) {
          this._am.setEventCallback(null);
          this._updating = false;
        }
        if (needRestart) {
          this._am.setEventCallback(null);
          var searchPaths = jsb.fileUtils.getSearchPaths();
          var newPaths = this._am.getLocalManifest().getSearchPaths();
          Array.prototype.unshift.apply(searchPaths, newPaths);
          cc.sys.localStorage.setItem("HotUpdateSearchPaths", JSON.stringify(searchPaths));
          jsb.fileUtils.setSearchPaths(searchPaths);
          cc.audioEngine.stopAll();
          setTimeout(function() {
            cc.game.restart();
          }, 100);
        }
      },
      hotUpdate: function hotUpdate() {
        if (this._am && !this._updating) {
          this._am.setEventCallback(this.updateCallback.bind(this));
          if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
            var url = this.manifestUrl.nativeUrl;
            cc.assetManager.md5Pipe && (url = cc.assetManager.md5Pipe.transformURL(url));
            this._am.loadLocalManifest(url);
          }
          this._failCount = 0;
          this._am.update();
          this._updating = true;
        }
      },
      checkCallback: function checkCallback(event) {
        switch (event.getEventCode()) {
         case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
          this.showLog("The local manifest file was not found, and the hot update was skipped.");
          this.hotUpdateFinish(true);
          break;

         case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
         case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
          this.showLog("Failed to download manifest file, skip hot update.");
          this.hotUpdateFinish(false);
          break;

         case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
          this.showLog("updated.");
          this.hotUpdateFinish(true);
          break;

         case jsb.EventAssetsManager.NEW_VERSION_FOUND:
          this.showLog("There is a new version, need to update");
          this._updating = false;
          this.hotUpdate();
          return;

         case jsb.EventAssetsManager.UPDATE_PROGRESSION:
          var percent = event.getPercent();
          if (isNaN(percent)) return;
          var msg = event.getMessage();
          this.showLog("checkCallback Update progress:" + percent + ", msg: " + msg);
          return;

         default:
          console.log("event.getEventCode():" + event.getEventCode());
          return;
        }
        this._am.setEventCallback(null);
        this._updating = false;
      },
      checkUpdate: function checkUpdate() {
        if (this._updating) {
          cc.log("Checking for updates...");
          return;
        }
        if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
          var url = this.manifestUrl.nativeUrl;
          cc.assetManager.md5Pipe && (url = cc.assetManager.md5Pipe.transformURL(url));
          this._am.loadLocalManifest(url);
        }
        if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
          this.showLog("Failed to load manifest file");
          return;
        }
        this._am.setEventCallback(this.checkCallback.bind(this));
        this._am.checkUpdate();
        this._updating = true;
        this.disPatchRateEvent(.01);
      },
      hotUpdateFinish: function hotUpdateFinish(result) {
        cc.director.emit("HotUpdateFinish", result);
      },
      disPatchRateEvent: function disPatchRateEvent(percent) {
        percent > 1 && (percent = 1);
        cc.director.emit("HotUpdateRate", percent);
      }
    });
    cc._RF.pop();
  }, {} ],
  LoginView: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "ae2deN+7ZtDs6biujOgpuyB", "LoginView");
    "use strict";
    cc.Class({
      extends: cc.Component,
      properties: {
        menuNode: {
          default: null,
          type: cc.Node
        },
        labelTips: {
          default: null,
          type: cc.Label
        }
      },
      onLoad: function onLoad() {
        this.menuNode.active = true;
      },
      onDestroy: function onDestroy() {},
      onEnable: function onEnable() {
        cc.director.on("HotUpdateFinish", this.onHotUpdateFinish, this);
        cc.director.on("HotUpdateRate", this.onHotUpdateRate, this);
      },
      onDisable: function onDisable() {
        cc.director.off("HotUpdateFinish", this.onHotUpdateFinish, this);
        cc.director.off("HotUpdateRate", this.onHotUpdateRate, this);
      },
      checkVersion: function checkVersion() {},
      onUpdateFinish: function onUpdateFinish() {
        this.menuNode.active = true;
        this.labelTips.string = "";
      },
      onHotUpdateFinish: function onHotUpdateFinish(param) {
        var result = param;
        result, this.onUpdateFinish();
      },
      onHotUpdateRate: function onHotUpdateRate(param) {
        var percent = param;
        percent > 1 && (percent = 1);
        this._updatePercent = percent;
        this.labelTips.string = "\u0110ANG TI\u1ebeN H\xc0NH C\u1eacP NH\u1eacT T\xc0I NGUY\xcaN GAME, TI\u1ebeN \u0110\u1ed8 C\u1eacP NH\u1eacT " + parseInt(1e4 * percent) / 100 + "%";
      },
      onBtnStartGame: function onBtnStartGame() {
        cc.director.loadScene("myScence");
      },
      onBtnBill: function onBtnBill() {
        cc.director.loadScene("myScence");
      }
    });
    cc._RF.pop();
  }, {} ],
  "audio-manager": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "857c0M2FS9AKYAcYevC5BEA", "audio-manager");
    "use strict";
    var AudioManager = cc.Class({
      extends: cc.Component,
      properties: {
        coinBetSound: {
          default: null,
          type: cc.AudioClip
        },
        timerSound: {
          default: null,
          type: cc.AudioClip
        },
        DrTigSound: {
          default: null,
          type: cc.AudioClip
        },
        DrTgBackSound: {
          default: null,
          type: cc.AudioClip
        }
      },
      statics: {
        instance: null
      },
      playCoinsInsert: function playCoinsInsert() {
        cc.audioEngine.playEffect(this.coinBetSound, false);
      },
      playDrTgBackSound: function playDrTgBackSound() {
        cc.audioEngine.playEffect(this.DrTgBackSound, false);
      },
      playDrTigSound: function playDrTigSound() {
        cc.audioEngine.playEffect(this.DrTigSound, false);
      },
      playTimeSound: function playTimeSound() {
        cc.audioEngine.playEffect(this.timerSound, false);
      },
      playSound: function playSound(audioClip) {
        if (!audioClip) return;
        cc.audioEngine.playMusic(audioClip, false);
      },
      onLoad: function onLoad() {
        AudioManager.instance = this;
      }
    });
    cc._RF.pop();
  }, {} ],
  mainGame: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "46c68mRk0pGP7362KHarR2g", "mainGame");
    "use strict";
    var _properties;
    function _createForOfIteratorHelperLoose(o, allowArrayLike) {
      var it;
      if ("undefined" === typeof Symbol || null == o[Symbol.iterator]) {
        if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && "number" === typeof o.length) {
          it && (o = it);
          var i = 0;
          return function() {
            if (i >= o.length) return {
              done: true
            };
            return {
              done: false,
              value: o[i++]
            };
          };
        }
        throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
      }
      it = o[Symbol.iterator]();
      return it.next.bind(it);
    }
    function _unsupportedIterableToArray(o, minLen) {
      if (!o) return;
      if ("string" === typeof o) return _arrayLikeToArray(o, minLen);
      var n = Object.prototype.toString.call(o).slice(8, -1);
      "Object" === n && o.constructor && (n = o.constructor.name);
      if ("Map" === n || "Set" === n) return Array.from(o);
      if ("Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
    }
    function _arrayLikeToArray(arr, len) {
      (null == len || len > arr.length) && (len = arr.length);
      for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
      return arr2;
    }
    var AudioManager = require("audio-manager");
    cc.Class({
      extends: cc.Component,
      properties: (_properties = {
        coinNode1: {
          default: null,
          type: cc.Node
        },
        coinNode2: {
          default: null,
          type: cc.Node
        },
        coinNode3: {
          default: null,
          type: cc.Node
        },
        coinNode4: {
          default: null,
          type: cc.Node
        },
        coinNode5: {
          default: null,
          type: cc.Node
        },
        coinNode6: {
          default: null,
          type: cc.Node
        },
        coin1move: {
          default: null,
          type: cc.Node
        },
        coin2move: {
          default: null,
          type: cc.Node
        },
        coin3move: {
          default: null,
          type: cc.Node
        },
        coin4move: {
          default: null,
          type: cc.Node
        },
        coin5move: {
          default: null,
          type: cc.Node
        },
        coin6move: {
          default: null,
          type: cc.Node
        },
        coin1: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin2: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin3: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin4: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin5: {
          default: [],
          type: [ cc.Prefab ]
        },
        coin6: {
          default: [],
          type: [ cc.Prefab ]
        },
        valuecoin1: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin2: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin3: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin4: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin5: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        valuecoin6: {
          default: true,
          visible: false,
          type: cc.Boolean
        },
        dragonbox: {
          default: null,
          type: cc.Node
        },
        dragonstop: {
          default: null,
          type: cc.Node
        },
        tiggerstop: {
          default: null,
          type: cc.Node
        },
        tigerbox: {
          default: null,
          type: cc.Node
        },
        sameResultNode: {
          default: null,
          type: cc.Node
        },
        sameResultstop: {
          default: null,
          type: cc.Node
        },
        crevalue: {
          default: 5e3,
          visible: false,
          type: cc.Integer
        },
        creditLabel: {
          default: null,
          type: cc.Label
        },
        isBetCoin: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        creditAvalable: {
          default: 5e3,
          type: cc.Integer
        },
        creditDragon: {
          default: 0,
          type: cc.Integer
        },
        creditTigger: {
          default: 0,
          type: cc.Integer
        },
        creditSameVal: {
          default: 0,
          type: cc.Integer
        },
        labelDragon: {
          default: null,
          type: cc.Label
        },
        labelTigger: {
          default: null,
          type: cc.Label
        },
        labelSameVal: {
          default: null,
          type: cc.Label
        },
        totalcredtilabel: {
          default: null,
          type: cc.Label
        },
        getBetVal: {
          default: 0,
          type: cc.Integer
        },
        timerBet: {
          default: null,
          visible: false,
          type: cc.Integer
        },
        timerLabel: {
          default: null,
          type: cc.Label
        },
        cardprefab: {
          default: [],
          type: [ cc.Prefab ]
        },
        exitButton: {
          default: null,
          type: cc.Node
        },
        resetButton: {
          default: null,
          type: cc.Node
        },
        openButton: {
          default: null,
          type: cc.Node
        },
        arrayPlayer: {
          default: [],
          visible: false,
          type: [ cc.Node ]
        },
        dragonvalue: {
          default: 0,
          type: cc.Integer
        },
        tigervalue: {
          default: 0,
          type: cc.Integer
        },
        samevalue: {
          default: 0,
          type: cc.Integer
        },
        LabelWin: {
          default: null,
          type: cc.Label
        },
        cardN0_Node: {
          default: null,
          type: cc.Node
        },
        cardN0_Node1: {
          default: null,
          type: cc.Node
        },
        attackDragon: {
          default: null,
          type: cc.Node
        },
        attackTiger: {
          default: null,
          type: cc.Node
        },
        vsNode: {
          default: null,
          type: cc.Node
        },
        totalWinBet: {
          default: null,
          type: cc.Label
        },
        totalWin: {
          default: 0,
          type: cc.Integer
        }
      }, _properties["labelDragon"] = {
        default: null,
        type: cc.Label
      }, _properties["labelTigger"] = {
        default: null,
        type: cc.Label
      }, _properties["labelSameVal"] = {
        default: null,
        type: cc.Label
      }, _properties),
      statics: {
        dfC1: null,
        dfC2: null,
        dfC3: null,
        dfC4: null,
        dfC5: null,
        dfC6: null
      },
      onLoad: function onLoad() {
        this.dfC1 = this.coinNode1.position;
        this.dfC2 = this.coinNode2.position;
        this.dfC3 = this.coinNode3.position;
        this.dfC4 = this.coinNode4.position;
        this.dfC5 = this.coinNode5.position;
        this.dfC6 = this.coinNode6.position;
        this.animator(this.coinNode1);
        this.animator(this.coinNode2);
        this.animator(this.coinNode3);
        this.animator(this.coinNode4);
        this.animator(this.coinNode5);
        this.animator(this.coinNode6);
        this.dfC1 = this.coin1move.position;
        this.dfC2 = this.coin2move.position;
        this.dfC3 = this.coin3move.position;
        this.dfC4 = this.coin4move.position;
        this.dfC5 = this.coin5move.position;
        this.dfC6 = this.coin6move.position;
        this.coinNode1.on(cc.Node.EventType.TOUCH_START, this.coin1Bet, this);
        this.coinNode2.on(cc.Node.EventType.TOUCH_START, this.coin2Bet, this);
        this.coinNode3.on(cc.Node.EventType.TOUCH_START, this.coin3Bet, this);
        this.coinNode4.on(cc.Node.EventType.TOUCH_START, this.coin4Bet, this);
        this.coinNode5.on(cc.Node.EventType.TOUCH_START, this.coin5Bet, this);
        this.coinNode6.on(cc.Node.EventType.TOUCH_START, this.coin6Bet, this);
        this.dragonbox.on(cc.Node.EventType.TOUCH_START, this.dragonButton, this);
        this.tigerbox.on(cc.Node.EventType.TOUCH_START, this.TigerButton, this);
        this.sameResultNode.on(cc.Node.EventType.TOUCH_START, this.sameButton, this);
        this.timerBetDragon();
      },
      animator: function animator(even) {
        var buttonBtn = even.addComponent(cc.Button);
        buttonBtn.transition = cc.Button.Transition.SCALE;
        buttonBtn.duration = .1;
        buttonBtn.zoomScale = 1.2;
      },
      openFun: function openFun() {
        this.resultCard();
      },
      dragonButton: function dragonButton() {
        var _this = this;
        console.log("playerButton -------------\x3e ");
        if (this.timerBet <= 0) return;
        var posx = this.getValue(-250, 250);
        var posy = this.getValue(-100, 100);
        if (false == this.valuecoin1 && this.crevalue >= 1) {
          this.coin1move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.dragonbox.x + posx, this.dragonbox.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this.coin1move);
            coin.setPosition(_this.coin1move.position);
            _this.node.addChild(coin);
            _this.arrayPlayer.push(coin);
            _this.coin1move.setPosition(_this.dfC1);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 1;
          this.dragonvalue += 1;
          this.labelDragon.string = this.dragonvalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.dragonvalue);
        }
        if (false == this.valuecoin2 && this.crevalue >= 5) {
          this.coin2move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.dragonbox.x + posx, this.dragonbox.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this.coin2move);
            coin.setPosition(_this.coin2move.position);
            _this.node.addChild(coin);
            _this.arrayPlayer.push(coin);
            _this.coin2move.setPosition(_this.dfC2);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 5;
          this.dragonvalue += 5;
          this.labelDragon.string = this.dragonvalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.dragonvalue);
        }
        if (false == this.valuecoin3 && this.crevalue >= 10) {
          this.coin3move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.dragonbox.x + posx, this.dragonbox.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this.coin3move);
            coin.setPosition(_this.coin3move.position);
            _this.node.addChild(coin);
            _this.arrayPlayer.push(coin);
            _this.coin3move.setPosition(_this.dfC3);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 10;
          this.dragonvalue += 10;
          this.labelDragon.string = this.dragonvalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.dragonvalue);
        }
        if (false == this.valuecoin4 && this.crevalue >= 20) {
          this.coin4move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.dragonbox.x + posx, this.dragonbox.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this.coin4move);
            coin.setPosition(_this.coin4move.position);
            _this.node.addChild(coin);
            _this.arrayPlayer.push(coin);
            _this.coin4move.setPosition(_this.dfC4);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 20;
          this.dragonvalue += 20;
          this.labelDragon.string = this.dragonvalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.dragonvalue);
        }
        if (false == this.valuecoin5 && this.crevalue >= 50) {
          this.coin5move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.dragonbox.x + posx, this.dragonbox.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this.coin5move);
            coin.setPosition(_this.coin5move.position);
            _this.node.addChild(coin);
            _this.arrayPlayer.push(coin);
            _this.coin5move.setPosition(_this.dfC5);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 50;
          this.dragonvalue += 50;
          this.labelDragon.string = this.dragonvalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.dragonvalue);
        }
        if (false == this.valuecoin6 && this.crevalue >= 100) {
          this.coin6move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.dragonbox.x + posx, this.dragonbox.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this.coin6move);
            coin.setPosition(_this.coin6move.position);
            _this.node.addChild(coin);
            _this.arrayPlayer.push(coin);
            _this.coin6move.setPosition(_this.dfC6);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 100;
          this.dragonvalue += 100;
          this.labelDragon.string = this.dragonvalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.dragonvalue);
        }
      },
      TigerButton: function TigerButton() {
        var _this2 = this;
        console.log("playerButton -------------\x3e ");
        if (this.timerBet <= 0) return;
        var posx = this.getValue(-250, 250);
        var posy = this.getValue(-100, 100);
        if (false == this.valuecoin1 && this.crevalue >= 1) {
          this.coin1move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.tiggerstop.x + posx, this.tiggerstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this2.coin1move);
            coin.setPosition(_this2.coin1move.position);
            _this2.node.addChild(coin);
            _this2.arrayPlayer.push(coin);
            _this2.coin1move.setPosition(_this2.dfC1);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 1;
          this.tigervalue += 1;
          this.labelTigger.string = this.tigervalue + " K";
          this.creditLabel.string = this.crevalue + " K";
          console.log(" check value :  ------- : " + this.dragonvalue);
        }
        if (false == this.valuecoin2 && this.crevalue >= 5) {
          this.coin2move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.tiggerstop.x + posx, this.tiggerstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this2.coin2move);
            coin.setPosition(_this2.coin2move.position);
            _this2.node.addChild(coin);
            _this2.arrayPlayer.push(coin);
            _this2.coin2move.setPosition(_this2.dfC2);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 5;
          this.tigervalue += 5;
          this.labelTigger.string = this.tigervalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.tigervalue);
        }
        if (false == this.valuecoin3 && this.crevalue >= 10) {
          this.coin3move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.tiggerstop.x + posx, this.tiggerstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this2.coin3move);
            coin.setPosition(_this2.coin3move.position);
            _this2.node.addChild(coin);
            _this2.arrayPlayer.push(coin);
            _this2.coin3move.setPosition(_this2.dfC3);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 10;
          this.tigervalue += 10;
          this.labelTigger.string = this.tigervalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.tigervalue);
        }
        if (false == this.valuecoin4 && this.crevalue >= 20) {
          this.coin4move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.tiggerstop.x + posx, this.tiggerstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this2.coin4move);
            coin.setPosition(_this2.coin4move.position);
            _this2.node.addChild(coin);
            _this2.arrayPlayer.push(coin);
            _this2.coin4move.setPosition(_this2.dfC4);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 20;
          this.tigervalue += 20;
          this.labelTigger.string = this.tigervalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.tigervalue);
        }
        if (false == this.valuecoin5 && this.crevalue >= 50) {
          this.coin5move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.tiggerstop.x + posx, this.tiggerstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this2.coin5move);
            coin.setPosition(_this2.coin5move.position);
            _this2.node.addChild(coin);
            _this2.arrayPlayer.push(coin);
            _this2.coin5move.setPosition(_this2.dfC5);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 50;
          this.tigervalue += 50;
          this.labelTigger.string = this.tigervalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.tigervalue);
        }
        if (false == this.valuecoin6 && this.crevalue >= 100) {
          this.coin6move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.tiggerstop.x + posx, this.tiggerstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this2.coin6move);
            coin.setPosition(_this2.coin6move.position);
            _this2.node.addChild(coin);
            _this2.arrayPlayer.push(coin);
            _this2.coin6move.setPosition(_this2.dfC6);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 100;
          this.tigervalue += 100;
          this.labelTigger.string = this.tigervalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.tigervalue);
        }
      },
      sameButton: function sameButton() {
        var _this3 = this;
        console.log("playerButton -------------\x3e ");
        if (this.timerBet <= 0) return;
        var posx = this.getValue(-250, 250);
        var posy = this.getValue(-100, 100);
        if (false == this.valuecoin1 && this.crevalue >= 1) {
          this.coin1move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.sameResultstop.x + posx, this.sameResultstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this3.coin1move);
            coin.setPosition(_this3.coin1move.position);
            _this3.node.addChild(coin);
            _this3.arrayPlayer.push(coin);
            _this3.coin1move.setPosition(_this3.dfC1);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 1;
          this.samevalue += 1;
          this.labelSameVal.string = this.samevalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.samevalue);
        }
        if (false == this.valuecoin2 && this.crevalue >= 5) {
          this.coin2move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.sameResultstop.x + posx, this.sameResultstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this3.coin2move);
            coin.setPosition(_this3.coin2move.position);
            _this3.node.addChild(coin);
            _this3.arrayPlayer.push(coin);
            _this3.coin2move.setPosition(_this3.dfC2);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 5;
          this.samevalue += 5;
          this.labelSameVal.string = this.samevalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.samevalue);
        }
        if (false == this.valuecoin3 && this.crevalue >= 10) {
          this.coin3move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.sameResultstop.x + posx, this.sameResultstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this3.coin3move);
            coin.setPosition(_this3.coin3move.position);
            _this3.node.addChild(coin);
            _this3.arrayPlayer.push(coin);
            _this3.coin3move.setPosition(_this3.dfC3);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 10;
          this.samevalue += 10;
          this.labelSameVal.string = this.samevalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.samevalue);
        }
        if (false == this.valuecoin4 && this.crevalue >= 20) {
          this.coin4move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.sameResultstop.x + posx, this.sameResultstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this3.coin4move);
            coin.setPosition(_this3.coin4move.position);
            _this3.node.addChild(coin);
            _this3.arrayPlayer.push(coin);
            _this3.coin4move.setPosition(_this3.dfC4);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 20;
          this.samevalue += 20;
          this.labelSameVal.string = this.samevalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.samevalue);
        }
        if (false == this.valuecoin5 && this.crevalue >= 50) {
          this.coin5move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.sameResultstop.x + posx, this.sameResultstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this3.coin5move);
            coin.setPosition(_this3.coin5move.position);
            _this3.node.addChild(coin);
            _this3.arrayPlayer.push(coin);
            _this3.coin5move.setPosition(_this3.dfC5);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 50;
          this.samevalue += 50;
          this.labelSameVal.string = this.samevalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.samevalue);
        }
        if (false == this.valuecoin6 && this.crevalue >= 100) {
          this.coin6move.runAction(cc.sequence(cc.moveTo(.1, cc.v2(this.sameResultstop.x + posx, this.sameResultstop.y - posy)), cc.callFunc(function() {
            var coin = cc.instantiate(_this3.coin6move);
            coin.setPosition(_this3.coin6move.position);
            _this3.node.addChild(coin);
            _this3.arrayPlayer.push(coin);
            _this3.coin6move.setPosition(_this3.dfC6);
            AudioManager.instance.playCoinsInsert();
          })));
          this.crevalue -= 100;
          this.samevalue += 100;
          this.labelSameVal.string = this.samevalue + "K";
          this.creditLabel.string = this.crevalue + "K";
          console.log(" check value :  ------- : " + this.samevalue);
        }
      },
      setvalue: function setvalue(index1) {
        var valuecard;
        index1 >= 0 && index1 <= 3 ? valuecard = 1 : index1 >= 4 && index1 <= 7 ? valuecard1 = 2 : index1 >= 8 && index1 <= 11 ? valuecard = 3 : index1 >= 12 && index1 <= 15 ? valuecard = 4 : index1 >= 16 && index1 <= 19 ? valuecard = 5 : index1 >= 20 && index1 <= 23 ? valuecard = 6 : index1 >= 24 && index1 <= 27 ? valuecard = 7 : index1 >= 28 && index1 <= 31 ? valuecard = 8 : index1 >= 32 && index1 <= 35 ? valuecard = 9 : index1 >= 36 && index1 <= 39 ? valuecard = 10 : index1 >= 40 && index1 <= 43 ? valuecard = 11 : index1 >= 44 && index1 <= 47 ? valuecard = 12 : index1 >= 48 && index1 <= 51 ? valuecard = 13 : console.log("------------------------error");
        return valuecard;
      },
      result: function result() {
        var index1 = this.getValue(0, 51);
        var index2 = this.getValue(0, 51);
        var tigervalue = this.setvalue(index1);
        var dragonvalue = this.setvalue(index2);
        var cardIndex = cc.instantiate(this.cardprefab[index1]);
        this.node.addChild(cardIndex);
        cardIndex.setPosition(cc.v2(this.cardN0_Node.x, this.cardN0_Node.y));
        this.cardN0_Node = cardIndex;
        var cardIndex1 = cc.instantiate(this.cardprefab[index2]);
        this.node.addChild(cardIndex1);
        cardIndex1.setPosition(cc.v2(this.cardN0_Node1.x, this.cardN0_Node1.y));
        this.cardN0_Node1 = cardIndex1;
        this.dragon();
        this.vsNode.opacity = 255;
        console.log("--------------- dragonvalue -------------------: " + dragonvalue);
        console.log("--------------- tigervalue -------------------: " + tigervalue);
        if (dragonvalue > tigervalue) {
          this.totalWin = 2 * this.dragonvalue;
          this.totalWinBet.string = this.totalWin.toString() + " K";
        } else if (dragonvalue < tigervalue) {
          this.totalWin = 2 * this.tigervalue;
          this.totalWinBet.string = this.totalWin.toString() + " K";
        } else {
          this.totalWin = 8 * this.samevalue;
          this.totalWinBet.string = this.totalWin.toString() + " K";
        }
        console.log("this.totalWin.string >>>>>>>> " + this.totalWin.string);
        console.log("totalWinBet >>>>>>>>>>>>>>>>>>>>>>> " + this.totalWinBet.string);
      },
      timerBetDragon: function timerBetDragon() {
        this.timerBet = 20;
        this.schedule(function() {
          if (this.timerBet > 0) {
            this.timerLabel.string = this.timerBet;
            AudioManager.instance.playTimeSound();
          }
          if (0 == this.timerBet) {
            this.timerLabel.string = "GO";
            this.result();
          }
          if (this.timerBet <= -7) {
            this.cardN0_Node1.opacity = 0;
            this.cardN0_Node.opacity = 0;
            this.dragonvalue = 0;
            this.samevalue = 0;
            this.tigervalue = 0;
            this.labelDragon.string = "0 K";
            this.labelTigger.string = "0 K";
            this.labelSameVal.string = "0 K";
            this.crevalue += this.totalWin;
            this.totalcredtilabel.string = this.crevalue.toString() + " K";
            this.timerBet = 20;
            for (var _iterator = _createForOfIteratorHelperLoose(this.arrayPlayer), _step; !(_step = _iterator()).done; ) {
              var coinMove = _step.value;
              cc.tween(coinMove).repeat(1, cc.tween().to(.7, {
                position: cc.v2(-50, -1e3)
              })).start();
              console.log("-------------- check move coin ------------");
            }
            this.dragon();
            this.dragonTigger();
            this.vsNode.opacity = 0;
          }
          this.timerBet--;
        }, 1);
      },
      dragon: function dragon() {
        cc.tween(this.attackDragon).repeat(1, cc.tween().to(.7, {
          position: cc.v2(-350.421, -5.948)
        })).start(), cc.tween(this.attackTiger).repeat(1, cc.tween().to(.7, {
          position: cc.v2(330.421, -5.511)
        })).start();
        AudioManager.instance.playDrTigSound();
      },
      dragonTigger: function dragonTigger() {
        cc.tween(this.attackDragon).repeat(1, cc.tween().to(.7, {
          position: cc.v2(-1663.719, -79.948)
        })).start(), cc.tween(this.attackTiger).repeat(1, cc.tween().to(.7, {
          position: cc.v2(1745.843, -106.511)
        })).start();
        AudioManager.instance.playDrTgBackSound();
      },
      coinfun: function coinfun(coinNode1, coin1, dfC1) {
        coinNode1.opacity = 0;
        var stop = cc.instantiate(coin1[0]);
        stop.setPosition(coinNode1.position);
        this.node.addChild(stop);
        coinNode1 = stop;
        coinNode1.setPosition(dfC1);
      },
      coin1function: function coin1function() {
        true == this.valuecoin1 && this.coinfun(this.coinNode1, this.coin1, this.dfC1);
      },
      coin2function: function coin2function() {
        console.log("--------------Hello ---------\x3e ");
        true == this.valuecoin2 && this.coinfun(this.coinNode2, this.coin2, this.dfC2);
      },
      coin3function: function coin3function() {
        console.log("--------------Hello ---------\x3e ");
        true == this.valuecoin3 && this.coinfun(this.coinNode3, this.coin3, this.dfC3);
      },
      coin4function: function coin4function() {
        console.log("--------------Hello ---------\x3e ");
        true == this.valuecoin4 && this.coinfun(this.coinNode4, this.coin4, this.dfC4);
      },
      coin5function: function coin5function() {
        console.log("--------------Hello ---------\x3e ");
        true == this.valuecoin5 && this.coinfun(this.coinNode5, this.coin5, this.dfC5);
      },
      coin6function: function coin6function() {
        console.log("--------------Hello ---------\x3e ");
        true == this.valuecoin6 && this.coinfun(this.coinNode6, this.coin6, this.dfC6);
      },
      cardMoveIn: function cardMoveIn() {
        for (var _iterator2 = _createForOfIteratorHelperLoose(this.arrayCard), _step2; !(_step2 = _iterator2()).done; ) {
          var coin = _step2.value;
          cc.tween(coin).repeat(1, cc.tween().to(2, {
            position: cc.v2(3.209, 210.464)
          })).start();
        }
      },
      coin1_Fun: function coin1_Fun() {
        this.coin1Bet();
        this.isBetCoin = 1;
      },
      coin5_Fun: function coin5_Fun() {
        this.coin2Bet();
        this.isBetCoin = 5;
      },
      coin10_Fun: function coin10_Fun() {
        this.coin3Bet();
        this.isBetCoin = 10;
      },
      coin20_Fun: function coin20_Fun() {
        this.coin4Bet();
        this.isBetCoin = 20;
      },
      coin50_Fun: function coin50_Fun() {
        this.coin5Bet();
        this.isBetCoin = 50;
      },
      coin100_Fun: function coin100_Fun() {
        this.coin6Bet();
        this.isBetCoin = 100;
      },
      coin1Bet: function coin1Bet() {
        if (true == this.valuecoin1) {
          console.log("--------------coin1Bet---------\x3e :" + this.valuecoin1);
          this.coinNode1.opacity = 0;
          var stop = cc.instantiate(this.coin1[1]);
          stop.setPosition(this.coinNode1.x, this.coinNode1.y);
          this.node.addChild(stop);
          this.coinNode1 = stop;
          this.coinNode1.setPosition(this.dfC1);
          this.valuecoin1 = false;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin2function();
          this.coin3function();
          this.coin4function();
          this.coin5function();
          this.coin6function();
        } else {
          console.log("--------------coin1Bet---------\x3e :" + this.valuecoin1);
          this.coinNode1.opacity = 0;
          var stop1 = cc.instantiate(this.coin1[0]);
          stop1.setPosition(this.coinNode1.position);
          this.node.addChild(stop1);
          this.coinNode1 = stop1;
          this.coinNode1.setPosition(this.dfC1);
          this.valuecoin1 = true;
        }
      },
      coin2Bet: function coin2Bet() {
        if (true == this.valuecoin2) {
          this.coinNode2.opacity = 0;
          var stop = cc.instantiate(this.coin2[1]);
          stop.setPosition(this.coinNode2.position);
          this.node.addChild(stop);
          this.coinNode2 = stop;
          this.coinNode2.setPosition(this.dfC2);
          this.valuecoin2 = false;
          this.valuecoin1 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin3function();
          this.coin4function();
          this.coin5function();
          this.coin6function();
        } else {
          this.valuecoin2 = true;
          this.coinNode2.opacity = 0;
          var stop1 = cc.instantiate(this.coin2[0]);
          stop1.setPosition(this.coinNode2.position);
          this.node.addChild(stop1);
          this.coinNode2 = stop1;
          this.coinNode2.setPosition(this.dfC2);
        }
      },
      coin3Bet: function coin3Bet() {
        if (true == this.valuecoin3) {
          this.coinNode3.opacity = 0;
          var stop = cc.instantiate(this.coin3[1]);
          stop.setPosition(this.coinNode3.position);
          this.node.addChild(stop);
          this.coinNode3 = stop;
          this.coinNode3.setPosition(this.dfC3);
          this.valuecoin3 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin2function();
          this.coin4function();
          this.coin5function();
          this.coin6function();
        } else {
          this.coinNode3.opacity = 0;
          var stop1 = cc.instantiate(this.coin3[0]);
          stop1.setPosition(this.coinNode3.position);
          this.node.addChild(stop1);
          this.coinNode3 = stop1;
          this.coinNode3.setPosition(this.dfC3);
          this.valuecoin3 = true;
        }
      },
      coin4Bet: function coin4Bet() {
        if (true == this.valuecoin4) {
          this.coinNode4.opacity = 0;
          var stop = cc.instantiate(this.coin4[1]);
          stop.setPosition(this.coinNode4.position);
          this.node.addChild(stop);
          this.coinNode4 = stop;
          this.coinNode4.setPosition(this.dfC4);
          this.valuecoin4 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin5 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin2function();
          this.coin3function();
          this.coin5function();
          this.coin6function();
        } else {
          this.coinNode4.opacity = 0;
          var stop1 = cc.instantiate(this.coin4[0]);
          stop1.setPosition(this.coinNode4.position);
          this.node.addChild(stop1);
          this.coinNode4 = stop1;
          this.coinNode4.setPosition(this.dfC4);
          this.valuecoin4 = true;
        }
      },
      coin5Bet: function coin5Bet() {
        if (true == this.valuecoin5) {
          this.coinNode5.opacity = 0;
          var stop = cc.instantiate(this.coin5[1]);
          stop.setPosition(this.coinNode5.position);
          this.node.addChild(stop);
          this.coinNode5 = stop;
          this.coinNode5.setPosition(this.dfC5);
          this.valuecoin5 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin6 = true;
          this.coin1function();
          this.coin2function();
          this.coin3function();
          this.coin4function();
          this.coin6function();
        } else {
          this.coinNode5.opacity = 0;
          var stop1 = cc.instantiate(this.coin5[0]);
          stop1.setPosition(this.coinNode5.position);
          this.node.addChild(stop1);
          this.coinNode5 = stop1;
          this.coinNode5.setPosition(this.dfC5);
          this.valuecoin5 = true;
        }
      },
      coin6Bet: function coin6Bet() {
        if (true == this.valuecoin6) {
          this.coinNode6.opacity = 0;
          var stop = cc.instantiate(this.coin6[1]);
          stop.setPosition(this.coinNode6.position);
          this.node.addChild(stop);
          this.coinNode6 = stop;
          this.coinNode6.setPosition(this.dfC6);
          this.valuecoin6 = false;
          this.valuecoin1 = true;
          this.valuecoin2 = true;
          this.valuecoin3 = true;
          this.valuecoin4 = true;
          this.valuecoin5 = true;
          this.coin1function();
          this.coin2function();
          this.coin3function();
          this.coin4function();
          this.coin5function();
        } else {
          this.coinNode6.opacity = 0;
          var stop1 = cc.instantiate(this.coin6[0]);
          stop1.setPosition(this.coinNode6.position);
          this.node.addChild(stop1);
          this.coinNode6 = stop1;
          this.coinNode6.setPosition(this.dfC6);
          this.valuecoin6 = true;
        }
      },
      activerCard: function activerCard(card) {
        cc.tween(card).repeat(4, cc.tween().to(.2, {
          position: cc.v2(card.x, card.y),
          angle: 360
        }, {
          easing: "sineOutIn"
        }).call(function() {}).to(.1, {
          position: cc.v2(card.x, card.y),
          angle: 360
        }, {
          easing: "sineOutIn"
        }).call(function() {}).to(.1, {
          position: cc.v2(card.x, card.y),
          angle: 360
        }, {
          easing: "sineOutIn"
        }).call(function() {}).to(.1, {
          position: cc.v2(card.x, card.y),
          angle: 0
        }, {
          easing: "sineOutIn"
        })).start();
      },
      getValue: function getValue(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
      start: function start() {}
    });
    cc._RF.pop();
  }, {
    "audio-manager": "audio-manager"
  } ],
  mainload: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "3e44drVc/ZH6ZYJvLkw7pIk", "mainload");
    "use strict";
    cc.Class({
      extends: cc.Component,
      properties: {
        load: {
          default: null,
          type: cc.Node
        }
      },
      onLoad: function onLoad() {
        this.load.on(cc.Node.EventType.TOUCH_START, this.loadingFun, this);
        this.animator(this.load);
      },
      animator: function animator(even) {
        var buttonBtn = even.addComponent(cc.Button);
        buttonBtn.transition = cc.Button.Transition.SCALE;
        buttonBtn.duration = .1;
        buttonBtn.zoomScale = 1.2;
      },
      loadingFun: function loadingFun() {
        cc.director.loadScene("myScence");
      },
      start: function start() {}
    });
    cc._RF.pop();
  }, {} ]
}, {}, [ "audio-manager", "HotUpdateModule", "LoginView", "mainGame", "mainload" ]);