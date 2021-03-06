define([
    'utils/ui',
    'utils/helpers',
    'events/events',
    'utils/backbone.events',
    'events/states',
    'utils/stretching',
    'utils/underscore'
], function(UI, utils, events, Events, states, stretchUtils, _) {
    var Display = function(_model) {
        var _display,
            _alternateClickHandler;

        _.extend(this, Events);

        _display = document.createElement('div');
        _display.className = 'jw-click';

        this.element = function() { return _display; };

        //_display.addEventListener('click', _clickHandler, false);
        var userInteract = new UI(this.element(), {'enableDoubleTap': true});
        userInteract.on('click tap', _clickHandler);
        userInteract.on('doubleClick doubleTap', _doubleClickHandler);

        _model.mediaController.on(events.JWPLAYER_PROVIDER_CLICK, _clickHandler);

        this.clickHandler = _clickHandler;

        var _this = this;
        function _clickHandler(evt) {
            var hasControls = _model.get('controls');
            var state = _model.get('state');

            if (_alternateClickHandler && (hasControls || state === states.PLAYING)) {
                _alternateClickHandler(evt);
                return;
            }

            if (!hasControls) {
                return;
            }

            _this.trigger((evt.type === events.touchEvents.CLICK) ? 'click' : 'tap');
        }

        // Handle double-clicks for fullscreen toggle
        function _doubleClickHandler() {
            _this.trigger('doubleClick');
        }

        /** NOT SUPPORTED : Using this for now to hack around instream API **/
        this.setAlternateClickHandler = function(handler) {
            _alternateClickHandler = handler;
        };

        this.revertAlternateClickHandler = function() {
            _alternateClickHandler = null;
        };
    };


    return Display;
});
