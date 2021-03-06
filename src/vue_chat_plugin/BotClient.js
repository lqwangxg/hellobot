"use strict";
exports.__esModule = true;
var ChatMessageObject_1 = require("./ChatMessageObject");
var ChatUserObject_1 = require("./ChatUserObject");
var localstorage_ponyfill_1 = require("localstorage-ponyfill");
/**
 * Botclient.
 */
var BotClient = /** @class */ (function () {
    /**
     * constructor of BotClient.
     * @param options
     */
    function BotClient(options) {
        /**
         * options of Botclient.
         */
        this.options = {
            ws_url: (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host,
            use_sockets: true,
            max_reconnect: 5,
            reconnect_timeout: 3000,
            enable_history: false,
            userid: Math.random().toString().substr(2, 6)
        };
        /**
         * htmlElement for BotClient event handler.
         */
        this.element = this.options.element;
        /**
         * try to reconnect count
         */
        this.reconnect_count = 0;
        /**
         * localStorage for saving user info under.
         */
        this.localStorage = localstorage_ponyfill_1.createLocalStorage();
        /**
         * BotClient user infomation.
         */
        this.user_profile = null;
        Object.assign(this.options, options);
        if (this.options.http_url) {
            this.options.ws_url = this.options.http_url.replace("http", "ws");
        }
    }
    /**
     * connect to server with userid and ws_url.
     * @param userid
     * @param http_url
     */
    BotClient.prototype.connect = function (userid, http_url) {
        if (userid) {
            this.options.userid = userid;
        }
        this.setCookie("userid", this.options.userid, 1);
        this.user_profile = this.getUserProfile(this.options.userid);
        //TODO:ユーザーIDにより、ユーザ基本情報を取得
        if (http_url) {
            this.options.ws_url = http_url.replace("http", "ws");
        }
        if (this.options.use_sockets) {
            this.connectWebsocket();
        }
        else {
            this.connectWebHook();
        }
    };
    /**
     * connect to sever by websocket.
     */
    BotClient.prototype.connectWebsocket = function () {
        var that = this;
        that.socket = new WebSocket(that.options.ws_url);
        /**
         * addEventListener for open connect event.
         */
        that.socket.addEventListener("open", function (event) {
            console.log("CONNECTED TO SERVER BY SOCKET");
            that.reconnect_count = 0;
            var msg = new ChatMessageObject_1["default"]({
                type: "hello",
                user: that.options.userid,
                text: "CONNECTED TO SERVER BY SOCKET"
            });
            that.send(msg, event);
            that.trigger("connected", msg);
        });
        that.socket.addEventListener("error", function (event) {
            console.error("ERROR", event);
        });
        that.socket.addEventListener("close", function (event) {
            console.log("SOCKET CLOSED!");
            that.trigger("closed", event);
            if (that.reconnect_count < that.options.max_reconnect) {
                setTimeout(function () {
                    console.log("RECONNECTING ATTEMPT ", ++that.reconnect_count);
                    that.connectWebsocket();
                }, that.options.reconnect_timeout);
            }
            else {
                console.log("socket addEventListener closed...");
            }
        });
        // Listen for messages received.
        that.socket.addEventListener("message", function (event) {
            try {
                var message = JSON.parse(event.data);
                console.log("addEventListener ==event.data=> ", event.data);
                message.received = true;
                var msg = new ChatMessageObject_1["default"](message);
                console.log("addEventListener ==msg=> ", msg);
                that.trigger(message.type, msg);
                var msgArray = [];
                var messageList = localStorage.getItem("messageList");
                if (messageList) {
                    msgArray = JSON.parse(messageList);
                }
                msgArray.push(msg);
                localStorage.setItem("messageList", JSON.stringify(msgArray));
            }
            catch (err) {
                that.trigger("socket_error", err);
                return;
            }
        });
    };
    BotClient.prototype.connectWebHook = function () {
        var that = this;
        var eventname = "hello";
        var message = new ChatMessageObject_1["default"]({
            type: eventname,
            user: that.options.userid,
            channel: "webhook"
            //channel: { type: "webhook", id: that.options.userid },
        });
        that.webhook(message);
        // connect immediately
        that.trigger("connected", message);
    };
    BotClient.prototype.on = function (event, handler) {
        this.element.$on(event, function (details) {
            handler(event, details);
        });
    };
    BotClient.prototype.trigger = function (event, details) {
        this.element.$emit(event, details);
    };
    BotClient.prototype.request = function (url, body) {
        return new Promise(function (resolve, reject) {
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState == XMLHttpRequest.DONE) {
                    if (xmlhttp.status == 200) {
                        var response = xmlhttp.responseText;
                        if (response != "") {
                            try {
                                var message = JSON.parse(response);
                                resolve(message);
                            }
                            catch (err) {
                                reject(err);
                                return;
                            }
                        }
                        else {
                            resolve({});
                        }
                    }
                    else {
                        reject(new Error("status_" + xmlhttp.status));
                    }
                }
            };
            xmlhttp.open("POST", url, true);
            xmlhttp.setRequestHeader("Content-Type", "application/json");
            xmlhttp.send(JSON.stringify(body));
        });
    };
    BotClient.prototype.send = function (message, event) {
        var that = this;
        if (event)
            event.preventDefault();
        message.user_profile = that.getUserProfile(message.author);
        if (that.options.use_sockets) {
            that.trySendMessage(message);
        }
        else {
            that.webhook(message);
        }
    };
    BotClient.prototype.trySendMessage = function (message) {
        var that = this;
        console.log("socket send message: ", message);
        if (that.socket.readyState === 1) {
            that.socket.send(JSON.stringify(message));
            return true;
        }
        else {
            setTimeout(that.trySendMessage, 100, message);
        }
    };
    BotClient.prototype.webhook = function (message) {
        var that = this;
        that
            .request("/api/messages", message)
            .then(function (messages) {
            if (Array.isArray(messages)) {
                messages.forEach(function (msg) {
                    that.trigger(msg.type, msg);
                });
            }
            else {
                that.trigger(messages.type, messages);
            }
        })["catch"](function (err) {
            that.trigger("webhook_error", err);
        });
    };
    BotClient.prototype.getUserProfile = function (userid) {
        if (this.options.userid) {
            //localStorageへ検索
            var userinfo = localStorage.getItem(this.options.userid);
            if (!userinfo) {
                var ui = new ChatUserObject_1["default"](userid);
                localStorage.setItem("userid", JSON.stringify(ui));
                return ui;
            }
            else {
                return JSON.parse(userinfo);
            }
        }
        return new ChatUserObject_1["default"](userid);
    };
    //==============================================
    /**
     * Cookie set/get
    */
    BotClient.prototype.setCookie = function (cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    };
    BotClient.prototype.getCookie = function (cname) {
        var name = cname + "=";
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(";");
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == " ") {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    };
    return BotClient;
}());
var client = new BotClient();
exports["default"] = client;
