/*******
** node-mpdsocket :: an MPD library for node.js
**
** author: Eli Wenig (http://eliwenig.com/) <eli@csh.rit.edu>
**
** copyright (c) 2011 Eli Wenig
** made available under the MIT license
**   http://www.opensource.org/licenses/mit-license.php
**
*******/

var net = require('net');
var sys = require('sys');

function mpdSocket(host,port) {
	if (!host) { 
		this.host = "localhost";
	} else {
		this.host = host;
	}

	if (!port){
		this.port = 6600;
	} else {
		this.port = port;
	}

	this.open(this.host,this.port);
}

mpdSocket.prototype = {
	callbacks: [],
	commands: [],
	isOpen: false,
	socket: null,
	version: "0",
	host: null,
	port: null,
	data: "",
  response: {},
  responses: [],

	handleData: function(datum) {
		this.data += datum;
		lines = this.data.split("\n");
		// Put back whatever's after the final \n for next time
		this.data = lines.pop(); 

		var match;
		for (var l in lines) {
			var line = lines[l];

			if (match = line.match(/^ACK\s+\[.*?\](?:\s+\{.*?\})?\s+(.*)/)) {
				this.callbacks.shift()(match[1], null);
				this.response = {};
				this.responses = [];
			}
			else if (line.match(/^OK MPD/)) {
				this.version = lines[l].split(' ')[2];
			}
			else if (line.match(/^OK/)) {
				if (this.responses.length > 0) {
					if (typeof(this.response) == 'string' || Object.keys(this.response).length > 0) {
						this.responses.push(this.response);
					}
					this.callbacks.shift()(null, this.responses);
				}
				else {
					this.callbacks.shift()(null, this.response);
				}
				this.response = {};
				this.responses = [];
			}
			else {
				// Matches 'key: val' or 'val'
				match = line.match(/^(?:(.*?):)?\s*(.*?)\s*$/)
				var key = match[1];
				var value = match[2];
				
				// New response if old response was a string or had this key defined already
				if (typeof(this.response) == 'string' || typeof(this.response[key]) != 'undefined') {
					this.responses.push(this.response);
					this.response = {};
				}
				
				if (typeof(key) == 'undefined') {
					this.response = value;
				}
				else {
					this.response[key] = value;
				}
			}
		}
	},
	
	on: function(event, fn) {
		this.socket.on(event,fn);
	},

	open: function(host,port) {
		var self = this;
		if (!(this.isOpen)) {
			this.socket = net.createConnection(port,host);
			this.socket.setEncoding('UTF-8');
			this.socket.addListener('connect',function() { self.isOpen = true; });
			this.socket.addListener('data',function(data) { self.handleData.call(self,data); self._send(); });
			this.socket.addListener('end',function() { self.isOpen = false; });
		}
	},

	_send: function() {
		if (this.commands.length != 0) this.socket.write(this.commands.shift() + "\n");
	},

	send: function(req,callback) {
		if (this.isOpen) {
			this.callbacks.push(callback);
			this.commands.push(req);
			if (this.commands.length == 1) this._send();
		} else {
			var self = this;
			this.open(this.host,this.port);
			this.on('connect',function() {
				self.send(req,callback);
			});
		}
	}
}

module.exports = mpdSocket;
