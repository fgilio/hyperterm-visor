'use strict';

const remove = require('lodash.remove');
const electron = require('electron');
const log = require('electron-log');
const { globalShortcut } = electron;

const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG || false;

module.exports = class Visor {
    constructor(app, visorWindow = null) {
        this.app = app;
        this.config = app.config.getConfig().visor || {};
        this.visorWindow = visorWindow;

        this.registerGlobalHotkey();
    }

    registerGlobalHotkey() {
        if (!this.config.hotkey) return;

        // Register a hotkey shortcut listener.
        const wasRegistered = globalShortcut.register(this.config.hotkey, () => this.toggleWindow());

        // @TODO error handling on failure?
        if (!wasRegistered) {
            debug('registration failed');
        } else {
            debug('registration worked');
        }
    }

    unregisterGlobalHotkey() {
        if (!this.config.hotkey) return;

        globalShortcut.unregister(this.config.hotkey);
    }

    toggleWindow() {
        debug('toggling window');

        if (!this.visorWindow) {
            // if no visor window, create one and try toggling again after it's created
            this.createNewVisorWindow(() => this.toggleWindow());
            return;
        }

        if (this.visorWindow.isFocused()) {
            this.visorWindow.hide();
        } else {
            this.setBounds();
            this.visorWindow.isVisible() ? this.visorWindow.focus() : this.visorWindow.show();
        }
    }

    setBounds() {
        debug(`setting position to ${this.config.position}`);

        if (!this.config.position) return;

        const screen = electron.screen;
        const point = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(point);
        const bounds = display.workArea;
        const { height, width } = bounds;

        switch (this.config.position) {
            case 'bottom':
                bounds.y += this.config.height || height / 2;
                bounds.width = this.config.width || width;
                // fall through
            case 'top':
                bounds.height = this.config.height || height / 2;
                bounds.width = this.config.width || width;
                break;
            case 'right':
                bounds.x += this.config.width || width / 2;
                bounds.height = this.config.height || height;
                // fall through
            case 'left':
                bounds.width = this.config.width || width / 2;
                bounds.height = this.config.height || height;
                break;
        }

        bounds.y = Math.round(bounds.y);
        bounds.width = Math.round(bounds.width);
        bounds.x = Math.round(bounds.x);
        bounds.height = Math.round(bounds.height);

        this.visorWindow.setBounds(bounds);
    }

    createNewVisorWindow(callback) {
        debug('creating new window');

        this.app.createWindow(win => {
            this.visorWindow = win;

            // creates a shell in the new window
            // @TODO revisit this after resolution of https://github.com/zeit/hyper/pull/976
            win.rpc.emit('termgroup add req');

            this.visorWindow.on('close', () => {
                debug('closing');

                this.visorWindow = null;
            });

            if (callback) {
                callback();
            }
        });
    }

    destroy() {
        this.unregisterGlobalHotkey();
        this.visorWindow = null;

        debug('destroyed');
        // @TODO other cleanup?
    }
};

function debug(...args) {
    if (DEBUG) {
        log.info(...args);
    }
}
