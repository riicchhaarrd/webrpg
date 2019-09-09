var viewport={width:width,height:height};
//(function()
//{
var canvas = document.getElementsByTagName("canvas")[0];
var ctx = canvas.getContext("2d");

canvas.width=width;
canvas.height=height;

var pixel_id = ctx.createImageData(1,1);
var pixel_id_data  = pixel_id.data;

var RGBA = function(r,g,b,a) {
	this.r=r;
	this.g=g;
	this.b=b;
	this.a=a;
	return this;
};

var set_pixel = function(x, y, color)
{
	ctx.fillStyle = "rgba("+color.r*255+","+color.g*255+","+color.b*255+","+(color.a)+")";
	ctx.fillRect( x, y, 1, 1 );
};

var rect = function(x, y, w, h, color)
{
	
	ctx.fillStyle = "rgba("+color.r*255+","+color.g*255+","+color.b*255+","+(color.a)+")";
	ctx.fillRect( x, y, w, h );
};

var clear = function()
{
	ctx.fillStyle="rgb(255,255,255)";
	ctx.clearRect(0,0,width,height);
};

var line = function(from, to, color)
{
	ctx.strokeStyle = "rgba("+color.r*255+","+color.g*255+","+color.b*255+","+(color.a)+")";
	ctx.beginPath();
	ctx.moveTo(from.x,from.y);
	ctx.lineTo(to.x,to.y);
	ctx.closePath();
	ctx.stroke();
};

var default_font = "12px Arial";
var color = {
	black: new RGBA(0,0,0,1),
	white: new RGBA(1,1,1,1)
};

var render_text = function(at, text, color, font)
{
	if(font == null)
		font = default_font;
	ctx.fillStyle = "rgba("+color.r*255+","+color.g*255+","+color.b*255+","+(color.a)+")";
	ctx.font = font;
	ctx.fillText(text, at.x,at.y);
};

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

var vector = function(a,b,c)
{
	this.x=a;
	this.y=b;
	this.z=c;
	
	if(b==null||c==null)
		this.y=this.z=this.x;
	return this;
};
var centervec = new vector(width/2,height/2,0);
var connected=false;

var mouse = {x:0,y:0,z:0};

var scalefactor = 6;

var spritesheet = function(img)
{
	this.image = new Image();
	this.image.src = img;
	return this;
};

var spritesheets = {
	character: new spritesheet("maps/lofi_char.png"),
	obj: new spritesheet("maps/lofi_obj.png")
};

var numsheetsloaded=0;
for(var idx in spritesheets)
{
var it = spritesheets[idx];
it.image.onload=function(){++numsheetsloaded;};
}

var sprite = function(sheet, x, y, w, h)
{
	this.x=x;
	this.y=y;
	this.w=w;
	this.h=h;
	this.sheet=sheet;
	return this;
};

var sprites = {
	fire: new sprite(spritesheets.obj, 0, 104, 8, 8)
};

var player = {
velocity:new vector(0),
origin:new vector(441,461,0),
angles:new vector(0),
firetime:0,
character:2,
actions:0
};

canvas.onmousemove = function(ev)
{
	mouse.x = ev.clientX;
	mouse.y = ev.clientY;
	
	//var from = player.origin; //not anymore
	var from = centervec;
	var v = vec.sub(new vector(ev.clientX,ev.clientY,0), from);
	player.angles = vec.unit(v);
	//console.log(player.angles);
};

var keys = [];

var FIRE = 1;
var CONTEXT = 2;

window.onkeydown = function(e)
{
	//console.log(ev);
	keys[e.key] = true;
};

window.onkeyup = function(e) {keys[e.key]=false;};
var clickcounter=0;
var mdown=false;
canvas.onclick=function(){++clickcounter;}
canvas.onmousedown=function(ev)
{
	var nx = ev.clientX;
	var ny = ev.clientY;
	//console.log(ev);
	//redraw();
	//player.actions |= FIRE;
	mdown=true;
};

canvas.onmouseup = function(e) {
	//player.actions &= ~FIRE;
	mdown=false;
};

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

var nummovementstances = 4;
var startstancesoffset = 465;

function get_render_origin(org)
{
	var porg = player.origin;
	var cxd2=-porg.x+viewport.width/scalefactor/2;
	var cyd2=-porg.y+viewport.height/scalefactor/2;
	org = vec.add(org, new vector(cxd2,cyd2,0));
	//org = vec.mul(org,new vector(scalefactor));
	return org;
}

var render_player = function(pidx,p,pc,character,local)
{
	var end = vec.mul(p.angles, new vector(100));
	var org = p.origin;
	if(local)
	{
	org=centervec;
	}
	else
	{
	org=get_render_origin(org);
	org=vec.mul(org,new vector(scalefactor));
	}
	//line(org, vec.add(org,end), new RGBA(0,0,1,1));
	var size = 8 * scalefactor;
	ctx.imageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.mozImageSmoothingEnabled = false;
	var img = spritesheets.character.image;
	var skin = character * nummovementstances + startstancesoffset;
	//if(!local)
	{
		//var walkdir = vec.sub(p.lerporigin,p.origin);
		var skinindex = 0;
		var rotation = (Math.atan2(p.angles.y, p.angles.x)) * 180 / Math.PI + 180;
		if(rotation >= 45 && rotation <= 135)
			skinindex=3; //up
		else if(rotation >= 135 && rotation <= (135+45))
			skinindex=0; //right
		else if(rotation >= (135+45) && rotation <= (135+45*2))
			skinindex=1;//down
		else
			skinindex=2;
		//console.log(rotation);
		skin = startstancesoffset + character * nummovementstances + skinindex;
	}
	var tw = 8;
	var div = ~~(img.width / tw);
	var sheet_x = ((skin % div) - 1) * tw;
	var sheet_y = (~~(skin / div)) * tw;
	
	ctx.drawImage(img, sheet_x, sheet_y, 8, 8, org.x-size/2, org.y-size/2, size, size);
	
	if(pc.health == null)
		return;
	if(pc.maxhealth == null)
		return;
	var percent = pc.health / pc.maxhealth;
	ctx.fillStyle="red";
	ctx.fillRect(org.x-size/2,org.y-size,size,4);
	//ctx.fillRect(org.x,org.y-size/2,size,4);
	ctx.fillStyle="lime";
	ctx.fillRect(org.x-size/2,org.y-size,size*percent,4);
	//ctx.fillRect(org.x,org.y-size/2,size*percent,4);

	if(local)
		return;
	ctx.fillStyle = "orange";
	ctx.font = "bold 14px arial";
	ctx.textBaseline = "top";
	ctx.fillText("Player #" + pidx, org.x-size/2,org.y-(size*2));
};

function now() { return new Date().getTime(); }

var enemy = function(pos, skin, spd)
{
	this.origin = pos;
	this.model = skin;
	this.speed = spd;
	this.angles = new vector(0,0,0);
	this.time = now();
	return this;
};

var enemies = [
	//new enemy(new vector(300,100,0), 3, 1)
];

var render_entity = function(e)
{
	var org = e.origin;
	org=get_render_origin(org);
	org=vec.mul(org,new vector(scalefactor));
	var size = 8 * scalefactor;
	ctx.imageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.mozImageSmoothingEnabled = false;
	//ctx.drawImage(spritesheets.character.image, 8*e.model, 0, 8, 8, org.x, org.y, size, size);
	ctx.drawImage(spritesheets.character.image, 8*e.model, 0, 8, 8, org.x-size/2, org.y-size/2, size, size);
	
	if(e.health == null)
		return;
	if(e.maxhealth == null)
		return;
	var percent = e.health / e.maxhealth;
	ctx.fillStyle="red";
	ctx.fillRect(org.x-size/2,org.y-size,size,4);
	//ctx.fillRect(org.x,org.y-size/2,size,4);
	ctx.fillStyle="lime";
	ctx.fillRect(org.x-size/2,org.y-size,size*percent,4);
	//ctx.fillRect(org.x,org.y-size/2,size*percent,4);
};

var enemy_think = function(e, dt)
{
	var dir=new vector((Math.random()-0.5)*2,(Math.random()-0.5)*2,0);
	if(now() - e.time > 500)
	{
		e.angles = vec.unit(vec.add(e.angles,dir));
		e.time = now();
	}
	var spdvec=vec.mul(new vector(e.speed),new vector(dt));
	e.origin = vec.add(e.origin, vec.mul(e.angles,spdvec));
};

var clients={};
var entities={};
var localclientnum = -1;

var scenedata=null;
var sceneimagery=[];
var sceneloaded=false;
function load_scene(n)
{
	$.getJSON('maps/'+n+'.json', function(json)
	{
		scenedata=json;
		var img = new Image();
		img.src = json.tilesets[0].image;
		img.onload=function(){sceneloaded=true;};
		sceneimagery.push(
			img
		);
	}).fail(function(){console.log('error');});
}

var scenecanvas=null;
var chunks=[];

function create_canvas(w,h)
{
	var c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	var context = c.getContext('2d');
	c.context = context;
	return c;
}

function draw_scene(_context, start_x, start_y, sf)
{
	if(!sceneloaded)
		return;
	/*
	if(scenecanvas!=null)
	{
		var sx = player.origin.x;
		var sy = player.origin.y;
		var sw = scenecanvas.width;
		var sh = scenecanvas.height;
		ctx.drawImage(scenecanvas,0,0,sw,sh);
		//ctx.drawImage(scenecanvas,sx,sy,sw,sh,0,0,(sw-sx)*scalefactor,(sh-sy)*scalefactor);
		//ctx.drawImage(scenecanvas,0,0,sw*scalefactor,sh*scalefactor);
		return;
	}
	scenecanvas = ctx.canvas.cloneNode();
    s = scenecanvas.getContext("2d");
	*/
	var layers=scenedata.layers;
	
	//var start_x = parseInt(player.origin.x);
	//var start_y = parseInt(player.origin.y);
	var sheet = sceneimagery[0];
	_context.imageSmoothingEnabled = false;
	_context.webkitImageSmoothingEnabled = false;
	_context.mozImageSmoothingEnabled = false;
	for(var idx in layers)
	{
		var layer = layers[idx];
		if(layer.data==null)continue;
		var data = layer.data;
		var tw = ~~(scenedata.tilewidth);
		var sw = width; //scenewidth;
		var sh = height; //sceneheight
		var col = ~~(sw / tw); //16
		var row = sh % tw;
		var div = ~~(sheet.width / tw);
		for(var x = 0; x < sw; x += tw)
		{
			for(var y = 0; y < sh; y += tw)
			{
				var fx = ~~(start_x+x);
				var fy = ~~(start_y+y);
				var rw = ~~(sheet.width);
				var tileno = parseInt(
					(fx / rw * (rw / tw))
					+
					(fy / rw * (rw / tw) * rw)
				);
				var tile = data[tileno];
				//var tile = 115;
				if(tile==0)continue;
				//console.log(tile);
				var sheet_x = ((tile % div) - 1) * tw;
				var sheet_y = (~~(tile / div)) * tw;
				_context.drawImage(sheet, sheet_x, sheet_y, tw, tw, x*sf, y*sf, tw*sf, tw*sf);
				//s.drawImage(sheet, x, y, tw, tw, start_x + x, start_y + y,
				//tw, tw);
				//console.log('sheet_x = ' + sheet_x + ', sheet_y = ' + sheet_y + ' tile = ' + tile);
			}
		}
		/*
		for(var i = 0; i < data.length; ++i)
		{
			var it = data[i];
			if(it==0)continue;
			var sheet = sceneimagery[0];
			var div = sheet.width / scenedata.tilewidth;
			var x = ((it % div)-1) * scenedata.tilewidth;
			var y = parseInt(it / div) * scenedata.tilewidth;
			var dx = ((i % layer.width)-1) * scenedata.tilewidth;
			var dy = parseInt(i / layer.width) * scenedata.tilewidth;
			s.drawImage(sheet, x, y, scenedata.tilewidth, scenedata.tileheight, dx, dy, scenedata.tilewidth, scenedata.tilewidth);
		}
		*/
	}
	//resize(scenecanvas,scalefactor);
}
load_scene("test");

function precache_scene()
{
	//just take the highest amount of either width or height and use that as size mostly the width is higher anyways so
	var scenewidthpx = scenedata.width * scenedata.tilewidth;
	var screenwidthpx = scenewidthpx; //what we're actually gonna see
	var numchunks = screenwidthpx / viewport.width;
	//console.log('numchunks', numchunks);
	var atx=0;
	var aty=0;
	for(var i = 0; i < numchunks*numchunks; ++i)
	{
		var tmp = create_canvas(viewport.width,viewport.height);
		draw_scene(tmp.context, atx,aty, 1);
		chunks.push(tmp);
		atx += viewport.width / scenedata.tilewidth;
		if(i%numchunks==0)//reset atx
		{
			atx=0;
			aty+=viewport.height/scenedata.tilewidth;
		}
		//$("#debug").append(tmp);
	}
}

var collisions = {
lofi_environment: [
0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,
0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,
0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,
0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,
1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,
1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,
1,1,1,1,1,1,1,1,0,0,0,1,0,0,1,1,
1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,
1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,
1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,
1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,
0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1
]
};

function get_tile_for_origin(x, y)
{
	if(scenedata==null)
		return [];
	var layers = scenedata.layers;
	var ts = scenedata.tilesets[0];
	var sheet = sceneimagery[0];
	var tw = ~~(scenedata.tilewidth);
	var tiles=[];
	for(var idx in layers)
	{
		var layer = layers[idx];
		if(layer.data == null)continue;
		var cd = collisions[ts.name];
		var fx = ~~(x);
		var fy = ~~(y);
		var rw = ~~(sheet.width);
		var data = layer.data;
		var index = parseInt(
			(fx / rw * (rw / tw))
			+
			(fy / rw * (rw / tw) * rw)
		);
		tiles.push(data[index]);
	}
	return tiles;
}

function is_origin_walkable(x, y)
{
	if(scenedata==null)
		return false;
	var layers = scenedata.layers;
	var ts = scenedata.tilesets[0];
	var sheet = sceneimagery[0];
	var tw = ~~(scenedata.tilewidth);
	for(var idx in layers)
	{
		var layer = layers[idx];
		if(layer.data == null)continue;
		var cd = collisions[ts.name];
		var fx = ((~~(x)) | 7) + 9;
		var fy = ((~~(y)) | 7) + 9;
		var rw = ~~(sheet.width);
		var data = layer.data;
		var index = parseInt(
			(fx / rw * (rw / tw))
			+
			(fy / rw * (rw / tw) * rw)
		);
		var tile = data[index];
		if(tile == 0) continue;
		var state = cd[tile];
		if(state == 0)
			return false; //not walkable
	}
	return true;
}

var draw = function()
{

	if(!connected)
	{
		render_text(new vector(100,100), "disconnected", new RGBA(1,0,0,1), "20px arial");
		return;
	}
	
	if(!sceneloaded)
		return;
	
	//scene.renderLayers();
	//draw_poly(p,new RGBA(1,0,0,1));
	if(chunks.length == 0)
	{
		precache_scene();
	} else
	{
		var org = player.origin;
		var ch = chunks[0];
		var cxd2=viewport.width/scalefactor/2;
		var cyd2=viewport.height/scalefactor/2;
		ctx.drawImage(ch,org.x-cxd2,org.y-cyd2,
		viewport.width/scalefactor,
		viewport.height/scalefactor,
		0,
		0,
		viewport.width,
		viewport.height);
	}
	render_text(new vector(100,100), is_origin_walkable(player.origin.x,player.origin.y) ? "walkable" : "not walkable", new RGBA(1,1,1,1), "20px arial");
	var td = get_tile_for_origin(player.origin.x,player.origin.y)
	render_text(new vector(200,200), JSON.stringify(td), new RGBA(1,1,1,1), "20px arial");
	
	//line(player.origin, vec.add(player.origin, player.angles), new RGBA(1,0,0,1));
	for(var idx in clients)
	{
		if(clients[idx].origin == null)
		continue;
		if(idx == localclientnum)
		{
			render_player(idx,player,clients[idx],clients[idx].character,true);
			continue;
		}
		//console.log(clients[idx].origin);
		render_player(idx,clients[idx],clients[idx],clients[idx].character,false);
	}
	
	for(var idx in entities)
	{
		var it = entities[idx];
		render_entity(it);
	}
	
	for(var idx in proj)
	{
		var it = proj[idx];
		//draw each projectile
		var org = it.origin;
		/*
		if(it.owner.number!=localclientnum)
		{
		org=get_render_origin(org);
		org.x*=scalefactor;
		org.y*=scalefactor;
		}
		*/
		//rect(org.x,org.y,10,10,new RGBA(0,1,0,1));
		var spr = sprites.fire;
		var rotation = (Math.atan2(it.angles.y, it.angles.x)+30) * 180 / Math.PI;
		//console.log(rotation);
		var DEG2RAD = Math.PI/180;
		ctx.save();
		ctx.translate(org.x,org.y);
		ctx.rotate(rotation*DEG2RAD);
		ctx.drawImage(spr.sheet.image, spr.x,spr.y,8,8,
		-(8*scalefactor)/2,
		-(8*scalefactor)/2,
		8*scalefactor,
		8*scalefactor);
		ctx.restore();
	}
};

var redraw = function() {
	clear();
	draw();
};

var sock = null;
var updatetime = 0;

var k_EMessageSnapshot = 0;
var k_EMessageGamestate = 1;
var k_EMessageTeleport = 2;

function get_client_origin(client)
{
	if(localclientnum==client.number)
	return centervec;
	return client.origin;
}

var frametime = 0;

var update = function(dt)
{
	//for chrome lol
	var nw = new Date().getTime();
	if(nw - frametime<(1000/60))
		return;
	frametime=nw;
	
	if(sock != null && sock.readyState == WebSocket.OPEN)
	{
		if(!connected)
			connected=true;
		if(new Date().getTime() - updatetime > (1000/50))
		{
			var ab = new ArrayBuffer(256);
			var v = new Uint8Array(ab);
			v[0] = k_EMessageSnapshot;
			var ac = player.actions;
			if(clickcounter>0 || mdown)
			{
				ac |= FIRE;
				--clickcounter;
			}
			v[1] = ac;
			
			var v = new Float32Array(ab, 4); //min is 4
			v[0] = player.origin.x;
			v[1] = player.origin.y;
			v[2] = player.origin.z;
			v[3] = player.angles.x;
			v[4] = player.angles.y;
			v[5] = player.angles.z;
			
			var view = new Uint8Array(ab);
			sock.send(view.buffer);
			updatetime=new Date().getTime();
		}
	}

	//logic goes here
	
	var dtv = new vector(dt);
	var speed = new vector(135);
	
	var up = new vector(0, -1, 0);
	var rt = new vector(1, 0, 0);
	
	var newvel = new vector(0);
	var prevorg=player.origin;
	/*
	while(!is_origin_walkable(player.origin.x,player.origin.y))
	{
		if(player.origin.x > 4000)
			break;
		if(player.origin.y>4000) break;
		player.origin.x+=1;
		player.origin.y+=1;
	}
	*/
	if(keys["w"])
		newvel = vec.add(newvel, vec.mul(speed, up));
	if(keys["s"])
		newvel = vec.add(newvel, vec.mul(speed, vec.mul(up,new vector(-1))));
	if(keys["d"])
		newvel = vec.add(newvel, vec.mul(speed, rt));
	if(keys["a"])
		newvel = vec.add(newvel, vec.mul(speed, vec.mul(rt,new vector(-1))));
	if(vec.len(newvel) > speed)
		newvel = vec.mul(vec.unit(newvel), speed);
	player.velocity=newvel;
	player.origin = vec.add(vec.mul(player.velocity,dtv), player.origin);
	if(!is_origin_walkable(player.origin.x,player.origin.y))
		player.origin=prevorg;
	var now = new Date().getTime();
	for(var idx in clients)
	{
		var it = clients[idx];
		var diff = now - it.firetime;
		var org = get_client_origin(it);
		if(it.number!=localclientnum)
		{
		org=get_render_origin(org);
		org.x*=scalefactor;
		org.y*=scalefactor;
		}
		if(diff > 50)
		{
			if(it.actions & FIRE)
			{
				proj.push(new projectile(it, vec.add(org,vec.mul(vec.unit(it.angles),new vector(8*scalefactor/2))), it.angles, 1500, 1250));
				it.firetime = now;
			}
		}
		var org = get_client_origin(it);
		if(it.lerporigin!=undefined)
		{
			var delta = vec.sub(it.lerporigin, org);
			it.origin = vec.add(org, vec.mul(delta, new vector(0.25)));
		}
	}
	
	//console.log(diff);
	
	for(var idx in enemies)
	{
		var it = enemies[idx];
		enemy_think(it, dt);
		for(var pidx in proj)
		{
			var pit = proj[pidx];
			//check if either of the projectile's points (rectangle are inside the enemies hitbox
			var org = pit.origin;
			//we're using a hardcoded 32 enemy/player size atm
			var sz = 8;
			var psz = 8; //projectile size
			var eorg=it.origin; //enemy origin
			if(
			org.x >= eorg.x && org.y >= eorg.y
			&&
			org.x + psz <= eorg.x + sz && org.y + psz <= eorg.y + sz
			)
			{
				console.log('hit enemy');
				//enemy got hit
				delete enemies[idx];
			}
		}
	}
	
	for(var idx in proj)
	{
		var it = proj[idx];
		var sv = new vector(it.speed*dt);
		it.origin = vec.add(it.origin, vec.mul(sv, it.angles));
		if(it.time < now) //we're dead
		{
			console.log('destroying projectile!');
			delete proj[idx];
		}
	}
};


var render = function()
{
	clear();
	redraw();
};

var scaledsheets=false;

var loading = false;
var frame = function(now) {
	//console.log(now);
	var dt = (1/60);
    update(dt);
	
	if(!loading)
	{
		sock = new WebSocket('wss://yourserverhere');
		sock.onerror = function()
		{
			connected=false;
		};
		sock.binaryType = 'arraybuffer';
		// Connection opened
		sock.addEventListener('open', function (event) {
			sock.send('Hello Server!');
		});
		
		// Listen for messages
		sock.addEventListener('message', function (event) {
			//console.log('Message from server ', event.data);
			
			var ab = event.data;//new ArrayBuffer(event.data);
			var hdr = new Uint8Array(ab);
			var op = hdr[0];
			if(op == k_EMessageTeleport)
			{
				var v = new Float32Array(ab, 4);
				player.origin = new vector(v[0],v[1],v[2]);
			} else if(op == k_EMessageSnapshot)
			{
				var np = hdr[1];
				var ne = hdr[2];
				var off = 4;
				var enums = [];
				for(var i = 0; i < ne; ++i)
				{
					var v = new Uint8Array(ab, off);
					off += 4;
					var entityNo = v[0];
					var maxhp = v[3];
					var model = v[1];
					var hp = v[2];
					var v = new Float32Array(ab, off);
					var pos = new vector(v[0],v[1],v[2]);
					var angles = new vector(v[3],v[4],v[5]);
					if(entities[entityNo] != undefined)
					{
						var t = entities[entityNo];
						t.lerporigin=pos;
						t.origin=pos;
						t.angles=angles;
						t.actions=actions;
						t.velocity=new vector(0);
						t.health=hp;
						t.maxhealth=maxhp;
						t.model = model;
					} else
					{
						entities[entityNo] = {
							origin: pos,
							angles: angles,
							model: model,
							health: hp,
							maxhealth: maxhp
						};
					}
					enums.push(entityNo);
					off += (3*4*2);
				}
				for(var it in entities)
				{
					var n = parseInt(it);
					if(!enums.includes(n)) {
						//console.log('deleting ' + n);
						delete entities[n];
					}
				}
				
				var nums = [];
				for(var i = 0; i < np; ++i)
				{
					var v = new Uint8Array(ab, off);
					off += 4;
					var clientNo = v[0];
					var maxhp = v[1];
					var hp = v[2];
					var actions = v[3];
					var v = new Float32Array(ab, off);
					var pos = new vector(v[0],v[1],v[2]);
					var angles = new vector(v[3],v[4],v[5]);
					if(clients[clientNo] != undefined)
					{
						var t = clients[clientNo];
						t.lerporigin=pos;
						t.angles=angles;
						t.actions=actions;
						t.health=hp;
						t.maxhealth=maxhp;
						t.velocity=new vector(0);
					} else
					{
						clients[clientNo] = {
							number: clientNo,
							velocity:new vector(0),
							origin: pos,
							angles: angles,
							firetime:0,
							character:~~(Math.random()*3),
							actions: actions,
							maxhealth: maxhp,
							health: hp
						};
					}
					nums.push(clientNo);
					//console.log(clientNo);
					//console.log(clients[clientNo]);
					off += (3*4*2);
				}
				for(var it in clients)
				{
					var n = parseInt(it);
					if(!nums.includes(n)) {
						//console.log('deleting ' + n);
						delete clients[n];
					}
				}
			} else if(op == k_EMessageGamestate)
			{
				localclientnum = hdr[2];
			} else
			{
				console.log('unknown op ' + op);
			}
			//console.log(event);
			//console.log(typeof event.data);
			
		});
		loading=true;
	}
	
	//do we have all the sheets loaded?
	if(Object.keys(spritesheets).length != numsheetsloaded)
	{
		//let's wait
		console.log('waiting' + numsheetsloaded);
	} else
	{
		if(!scaledsheets)
		{
			console.log('scaling sheets');
			
			for(var idx in spritesheets)
			{
				var it = spritesheets[idx];
				//it.image = resize(it.image, scalefactor);
			}
			scaledsheets=true;
		}
		else render();
	}
	req = requestAnimationFrame(frame);
};

//spawn some random enemies
for(var i = 0; i < 50; ++i)
{

	var skin = parseInt(Math.random() * 5);
	var rx = Math.random() * 1000;
	var ry = Math.random() * 1000;
	//enemies.push(new enemy(new vector(rx,ry,0), skin, 1));
}

requestAnimationFrame(frame);
/*
setInterval(() => 
{
redraw();
}, 300);
*/
//})();