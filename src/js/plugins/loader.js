define([
    'plugins/utils',
    'utils/helpers',
    'events/events',
    'utils/backbone.events',
    'utils/underscore',
    'utils/scriptloader'
], function(pluginsUtils, utils, events, Events, _, scriptloader) {

    var PluginLoader = function (model, _config) {
        var _this = _.extend(this, Events),
            _status = scriptloader.loaderstatus.NEW,
            _iscomplete = false,
            _pluginCount = _.size(_config),
            _pluginLoaded,
            _destroyed = false;

        /*
         * Plugins can be loaded by multiple players on the page, but all of them use
         * the same plugin model singleton. This creates a race condition because
         * multiple players are creating and triggering loads, which could complete
         * at any time. We could have some really complicated logic that deals with
         * this by checking the status when it's created and / or having the loader
         * redispatch its current status on load(). Rather than do this, we just check
         * for completion after all of the plugins have been created. If all plugins
         * have been loaded by the time checkComplete is called, then the loader is
         * done and we fire the complete event. If there are new loads, they will
         * arrive later, retriggering the completeness check and triggering a complete
         * to fire, if necessary.
         */
        function _complete() {
            if (!_iscomplete) {
                _iscomplete = true;
                _status = scriptloader.loaderstatus.COMPLETE;
                _this.trigger(events.COMPLETE);
            }
        }

        // This is not entirely efficient, but it's simple
        function _checkComplete() {
            // Since we do not remove event listeners on pluginObj when destroying
            if (_destroyed) {
                return;
            }
            if (!_config || _.keys(_config).length === 0) {
                _complete();
            }
            if (!_iscomplete) {
                var plugins = model.getPlugins();
                _pluginLoaded = _.after(_pluginCount, _complete);
                _.each(_config, function (value, plugin) {
                    var pluginName = pluginsUtils.getPluginName(plugin),
                        pluginObj = plugins[pluginName],
                        js = pluginObj.getJS(),
                        target = pluginObj.getTarget(),
                        status = pluginObj.getStatus();

                    if (status === scriptloader.loaderstatus.LOADING || status === scriptloader.loaderstatus.NEW) {
                        return;
                    } else if (js && !utils.versionCheck(target)) {
                        _this.trigger(events.ERROR, {
                            message: 'Incompatible player version'
                        });
                    }
                    _pluginLoaded();
                });

            }
        }

        function _pluginError(e) {
            // Since we do not remove event listeners on pluginObj when destroying
            if (_destroyed) {
                return;
            }
            var message = 'File not found';
            if (e.url) {
                utils.log(message, e.url);
            }
            this.off();
            this.trigger(events.ERROR, {
                message: message
            });
            _checkComplete();
        }

        this.setupPlugins = function (api, config, resizer) {
            var flashPlugins = [],
                jsPlugins = {},
                plugins = model.getPlugins();

            _.each(config.plugins, function(pluginConfig, plugin) {
                var pluginName = pluginsUtils.getPluginName(plugin),
                    pluginObj = plugins[pluginName],
                    flashPath = pluginObj.getFlashPath(),
                    jsPlugin = pluginObj.getJS(),
                    pluginURL = pluginObj.getURL();

                if (flashPath) {
                    var flashPluginConfig = _.extend({
                        name: pluginName,
                        swf: flashPath,
                        pluginmode: pluginObj.getPluginmode()
                    }, pluginConfig);
                    flashPlugins.push(flashPluginConfig);
                }

                var status = utils.tryCatch(function() {
                    if (jsPlugin && config.plugins && config.plugins[pluginURL]) {
                        var div = document.createElement('div');
                        div.id = api.id + '_' + pluginName;
                        div.style.position = 'absolute';
                        div.style.top = 0;
                        jsPlugins[pluginName] = pluginObj.getNewInstance(api,
                            _.extend({}, config.plugins[pluginURL]), div);
                        api.onReady(resizer(jsPlugins[pluginName], div, true));
                        api.onResize(resizer(jsPlugins[pluginName], div));
                    }

                });

                if (status instanceof utils.Error) {
                    utils.log('ERROR: Failed to load ' + pluginName + '.');
                }
            });

            api.plugins = jsPlugins;
            config.flashPlugins = flashPlugins;
        };

        this.load = function () {
            // Must be a hash map
            if (utils.exists(_config) && utils.typeOf(_config) !== 'object') {
                _checkComplete();
                return;
            }

            _status = scriptloader.loaderstatus.LOADING;

            /** First pass to create the plugins and add listeners **/
            _.each(_config, function(value, plugin) {
                if (utils.exists(plugin)) {
                    var pluginObj = model.addPlugin(plugin);
                    pluginObj.on(events.COMPLETE, _checkComplete);
                    pluginObj.on(events.ERROR, _pluginError);
                }
            });

            var plugins = model.getPlugins();

            /** Second pass to actually load the plugins **/
            _.each(plugins, function(pluginObj) {
                // Plugin object ensures that it's only loaded once
                pluginObj.load();
            });

            // Make sure we're not hanging around waiting for plugins that already finished loading
            _checkComplete();
        };

        this.destroy = function () {
            _destroyed = true;
            this.off();
        };

        this.pluginFailed = _pluginError;

        this.getStatus = function () {
            return _status;
        };

    };

    return PluginLoader;
});
