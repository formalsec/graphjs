var request = require("request");

function API(domain) {
	this.domain = domain;
}

API.prototype.login = function (name, password, cb) {
	var domain = this.domain;
	request({
		url: "http://" + domain + "/admin/api/user/login",
		method: "POST",
		body: JSON.stringify({
			"name": name,
			"password": password
		}),
		headers: {
			"Content-type": "application/json"
		}

	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			cb(JSON.parse(body));
		} else {
			cb();
		}
	});
};

API.prototype.commit = function (user, widget, comment, cb) {
	var domain = this.domain;
	var cookie = request.cookie("u=" + user.id);
	var jar = request.jar();
	jar.add(cookie);
	var content = {
		widget: widget,
		comment: comment
	};
	request({
		url: "http://" + domain + "/admin/api/widget/commit",
		headers: {
			"Content-type": "application/json"
		},
		jar: jar,
		method: "POST",
		body: JSON.stringify(content)
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			cb(200);
		} else {
			cb(403);
		}
	});
};

API.prototype.loadWidgetExtInfo = function (user, widgetName, cb) {
	var domain = this.domain;
	var cookie = request.cookie("u=" + user.id);
	var jar = request.jar();
	jar.add(cookie);

	request({
		url: "http://" + domain + "/admin/api/widget/" + widgetName + "/extInfo",
		headers: {
			"Content-type": "application/json"
		},
		jar: jar,
		method: "GET"
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			cb(JSON.parse(body));
		} else {
			cb(403);
		}
	});
};

API.prototype.loadAllWidget = function (user, cb) {
	var domain = this.domain;
	var cookie = request.cookie("u=" + user.id);
	var jar = request.jar();
	jar.add(cookie);

	request({
		url: "http://" + domain + "/admin/api/widget",
		headers: {
			"Content-type": "application/json"
		},
		jar: jar,
		method: "GET"
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			cb(JSON.parse(body));
		} else {
			cb(403);
		}
	});
};

API.prototype.loadAllLayout = function (user, cb) {
	var domain = this.domain;
	var cookie = request.cookie("u=" + user.id);
	var jar = request.jar();
	jar.add(cookie);

	request({
		url: "http://" + domain + "/admin/api/layout",
		headers: {
			"Content-type": "application/json"
		},
		jar: jar,
		method: "GET"
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			cb(JSON.parse(body));
		} else {
			cb(403);
		}
	});
};

API.prototype.preview = function (user, shopId, widget, cb) {
	var domain = this.domain;
	var cookie = request.cookie("u=" + user.id);
	var jar = request.jar();
	jar.add(cookie);
	request({
		url: "http://" + domain + "/admin/wizardPreviewAction.action",
		headers: {
			"Content-type": "application/x-www-form-urlencoded"
		},
		jar: jar,
		method: "POST",
		body: "shopId=" + shopId + "&widgetString=" + encodeURIComponent(JSON.stringify(widget))
	}, function (error, response, body) {
		cb(body);
	});
};

var apiPool = {
	alpha: new API("alpha.wizard.dp"),
	beta: new API("beta.wizard.dp"),
	pre: new API("pre.wizard.dp"),
	product: new API("wizard.dp")
};

exports.getAPI = function (env) {
	return apiPool[env];
};