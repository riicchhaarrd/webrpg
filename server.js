#!/usr/bin/env node

var vector = function(a,b,c)
{
	this.x=a;
	this.y=b;
	this.z=c;
	
	if(b==null||c==null)
		this.y=this.z=this.x;
	return this;
};

function get_random_spawn()
{
	return new vector(450 + (Math.random()-1) * 60, 450 + (Math.random()-1) * 60, 0);
}

var WebSocketServer = require('websocket').server,
http = require('http'),
fs = require('fs');

var server = http.createServer(function(request, response) {
var filePath = './index.html';
var data = fs.readFileSync(filePath, 'utf8');
console.log((new Date()) + " Received request for " + request.url);
response.end(data);
});

server.listen(8080, function() {
console.log((new Date()) + " Server is listening on port 8080");
});

wsServer = new WebSocketServer({
httpServer: server,
maxReceivedFrameSize: 0x1000000,
autoAcceptConnections: false
});

var clients = [];
var clientNo = 0;
var npcs = [];
var proj = [];

var projectile = function(owner, start, dir, ls, speed)
{
	this.owner = owner;
	this.origin = start;
	this.angles = dir;
	this.time = new Date().getTime() + ls;
	this.speed = speed;
	return this;
};

var k_EPlayerFlagTeleported = 1;

function teleport_client(client, pos)
{
	client.player.flags |= k_EPlayerFlagTeleported;
	client.player.origin = pos;
	var buf = new Buffer(4 + 8 * 3);
	buf.writeInt8(2, 0); //TELEPORT
	buf.writeInt8(0, 1);
	buf.writeInt8(0, 2);
	buf.writeInt8(0, 3);
	
	var n = 4;
	buf.writeFloatLE(client.player.origin.x, n); n += 4;
	buf.writeFloatLE(client.player.origin.y, n); n += 4;
	buf.writeFloatLE(client.player.origin.z, n); n += 4;
	client.sendBytes(buf);
}

function send_snapshot(client)
{
	var buf = new Buffer(4096);
	buf.writeInt8(0, 0); //SNAPSHOT
	buf.writeInt8(clients.length, 1);
	buf.writeInt8(npcs.length, 2);
	buf.writeInt8(0, 3);
	
	var n = 4;
	
	for(var idx in npcs)
	{
		var it = npcs[idx];
		buf.writeInt8(it.id, n++);
		buf.writeInt8(it.model, n++);
		buf.writeInt8(it.health, n++);
		buf.writeInt8(it.maxhealth, n++);
		buf.writeFloatLE(it.origin.x, n); n += 4;
		buf.writeFloatLE(it.origin.y, n); n += 4;
		buf.writeFloatLE(it.origin.z, n); n += 4;
		buf.writeFloatLE(it.angles.x, n); n += 4;
		buf.writeFloatLE(it.angles.y, n); n += 4;
		buf.writeFloatLE(it.angles.z, n); n += 4;
	}
	
	for(var idx in clients)
	{
		var it = clients[idx];
		buf.writeInt8(it.clientNo, n++);
		buf.writeInt8(it.player.maxhealth, n++);
		buf.writeInt8(it.player.health, n++);
		buf.writeInt8(it.player.actions, n++);
		buf.writeFloatLE(it.player.origin.x, n); n += 4;
		buf.writeFloatLE(it.player.origin.y, n); n += 4;
		buf.writeFloatLE(it.player.origin.z, n); n += 4;
		buf.writeFloatLE(it.player.angles.x, n); n += 4;
		buf.writeFloatLE(it.player.angles.y, n); n += 4;
		buf.writeFloatLE(it.player.angles.z, n); n += 4;
	}
	client.sendBytes(buf);
}

function send_gamestate(client)
{
	var buf = new Buffer(1024);
	buf.writeInt8(1, 0); //GAMESTATE
	buf.writeInt8(clients.length, 1);
	buf.writeInt8(client.clientNo, 2);
	buf.writeInt8(0, 3);
	client.sendBytes(buf);
}

var npcNo = 0;

var ACTION_FIRE = 1;
var ACTION_CONTEXT = 2;

var vec = {
	dot: function(a,b)
	{
		return a.x * b.x + a.y * b.y + a.z * b.z;
	},
	dot_unit: function(a,b)
	{
		return this.dot(a,b) / (this.len(a) * this.len(b));
	},
	len: function(v)
	{
		return Math.sqrt(this.dot(v,v));
	},
	dist: function(a,b)
	{
		var v = this.sub(a,b);
		return Math.sqrt(this.dot(v,v));
	},
	sub: function(a,b)
	{
		return {
			x: a.x - b.x,
			y: a.y - b.y,
			z: a.z - b.z
		};
	},
	add: function(a,b)
	{
		return {
			x: a.x + b.x,
			y: a.y + b.y,
			z: a.z + b.z
		};
	},
	div: function(a,b)
	{
		return {
			x: a.x / b.x,
			y: a.y / b.y,
			z: a.z / b.z
		};
	},
	mul: function(a,b)
	{
		return {
			x: a.x * b.x,
			y: a.y * b.y,
			z: a.z * b.z
		};
	},
	unit: function(v)
	{
		return this.div(v, new vector(this.len(v)));
	},
	cross: function(a,b)
	{
		return new vector(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
	}
};

function get_closest_npc(org)
{
	var closest = null;
	for(var idx in npcs)
	{
		var it = npcs[idx];
		if(closest == null || vec.dist(closest.origin, org) > vec.dist(it.origin, org))
			closest=it;
	}
	return closest;
}

function get_closest_player(org)
{
	var closest = null;
	for(var idx in clients)
	{
		var it = clients[idx];
		var p = it.player;
		if(closest == null || vec.dist(closest.origin, org) > vec.dist(p.origin, org))
			closest=p;
	}
	return closest;
}

var npc_think = function(e, dt)
{
	var now = new Date().getTime();
	var dir=new vector((Math.random()-0.5)*2,(Math.random()-0.5)*2,0);
	
	var pl = get_closest_player(e.origin);
	if(pl != null)
		dir=vec.unit(vec.sub(pl.origin,e.origin));
	if(now - e.time > 500)
	{
		e.angles = vec.unit(vec.add(e.angles,dir));
		e.time = now;
	}
	var spdvec=vec.mul(new vector(e.speed),new vector(dt));
	e.origin = vec.add(e.origin, vec.mul(e.angles,spdvec));
};

function client_frame(c)
{
	var now = new Date().getTime();
	var p = c.player;
	var npc = get_closest_npc(p.origin);
	
	if(npc != null)
	{
		var dist = vec.dist(npc.origin,p.origin);
		//console.log(npc.origin,p.origin,dist);
	}
	if(p.health <= 0)
	{
		//died
		p.health=p.maxhealth;
		teleport_client(c,get_random_spawn());
	}
	
	for(var q in proj)
	{
		var qit = proj[q];
		if(qit.owner==p)continue;
		if(bbox_test(p.origin,qit.origin,2,8))
		{
			qit.time = now; //make it dead
			deadprojs.push(qit);
			//deadents.push(npc);
			//console.log('killed player');
			p.health -= 10;
		}
	}
	
	//calc rate of fire and the distance each "projectile" has travelled and whether it's hitting any entity
	var projectileSpeed = 12.5; //hardcoded atm
	if(p.actions & ACTION_FIRE)
	{
		if(now - p.firetime > 50)
		{
			proj.push(new projectile(p, p.origin, p.angles, 1500, 1250 / 3)); //1250
			p.firetime = now;
		}
	}
}

function is_npc_alive(n)
{
	return n.health > 0;
}

function bbox_test(a,b,psz,sz)
{
	return (Math.abs(a.x - b.x) * 2 < (sz + psz)) &&
         (Math.abs(a.y - b.y) * 2 < (sz + psz));
}

var deadprojs=[];
var deadents=[];
setInterval(function()
{
	deadents=[];
	deadprojs=[];
	
	var dt = (1/60);
	
	if(npcs.length < 5)
	{
		npcs.push(
		{
			id: (npcNo++) % 127,
			model: parseInt(Math.random() * 9),
			angles: new vector(0),
			origin: get_random_spawn(),
			speed: 3 + parseInt(Math.random() * 2),
			time: 0,
			health: 100,
			maxhealth: 100
		}
		);
		//console.log('npcs: ' + npcs.length);
	}
	var now = new Date().getTime();
	for(var idx in clients)
	{
		var it = clients[idx];
		client_frame(it);
		send_snapshot(it);
	}
	for(var idx in npcs)
	{
		var it = npcs[idx];
		if(!is_npc_alive(it))
		{
			deadents.push(idx);
			continue;
		}
		npc_think(it, dt);
		for(var q in proj)
		{
			var qit = proj[q];
			if(bbox_test(it.origin,qit.origin,2,8))
			{
				qit.time = now; //make it dead
				deadprojs.push(qit);
				//deadents.push(npc);
				it.health -= 10;
			}
		}
	}
	
	for(var idx in proj)
	{
		var it = proj[idx];
		var sv = new vector(it.speed * dt);
		it.origin = vec.add(it.origin, vec.mul(sv, it.angles));
		if(it.time <= now) //we're dead
		{
			//console.log('destroying projectile!');
			deadprojs.push(idx);
			continue;
		}
	}
	
	//clean up all the dead entities
	for(var it in deadprojs)
	{
		proj.splice(deadprojs[it],1);//delete proj[idx];
	}
	
	for(var it in deadents)
	{
		npcs.splice(deadents[it], 1);
	}
}, 1000 / 60);

wsServer.on('request', function(request) {

	var client = request.accept(null, request.origin);
	client.clientNo = clientNo++;
	client.player = {origin:new vector(0),angles:new vector(0),actions:0,projectiles:[],firetime:0,flags:0,maxhealth:100,health:100};
	send_gamestate(client);
	
	clients.push(client);
	console.log((new Date()) + " Connection accepted.");
	client.on('message', function(message) {
	if (message.type === 'utf8') {
		// NOP
	}
	else if (message.type === 'binary') {
		//console.log("Received Binary Message of " + message.binaryData.length + " bytes");
		//console.log(message.binaryData);
		
		var data = message.binaryData;
		
		var op = data.readUInt8(0);
		var actions = data.readUInt8(1);
		//console.log(op);
		
		//var pos = read_vec(data,4);
		//var angles = read_vec(data,12);
		client.player.actions = actions;
		//won't accept origin if they recently got teleported
		var newpos=new vector(
			data.readFloatLE(4),
			data.readFloatLE(8),
			data.readFloatLE(12)
		);
		var dt = (1/20);
		//TODO fix this later etc
		if((client.player.flags & k_EPlayerFlagTeleported) == k_EPlayerFlagTeleported
		&&
		//or the speed they have is acceptable
		vec.dist(client.player.origin,newpos) > dt * 135 * 2
		)
		{
			teleport_client(client,client.player.origin);
		} else
		{
			client.player.origin = newpos;
			client.player.flags &= ~k_EPlayerFlagTeleported; //remove the teleport flag
		}
		client.player.angles = new vector(
			data.readFloatLE(16),
			data.readFloatLE(20),
			data.readFloatLE(24)
		);
	}
});

	client.on('close', function(reasonCode, description) {
		for(var i = 0; i < clients.length; ++i)
		{
			if(clients[i] == client)
			{
				clients.splice(i,1);
				break;
			}
		}
		console.log((new Date()) + " Peer " + client.remoteAddress + " disconnected.");
	});
});
