import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../src-tauri/src/wrapper.js', import.meta.url), 'utf8');
function setup(labels = [], pathname = "/album/123", options = {}) {
  const listeners = {}, elements = [], clicks = [], intervals = [];
  const element = (tag) => {
    const attributes = {}, handlers = {};
    const node = { tagName: tag.toUpperCase(), dataset: {}, style: {}, children: [],
      setAttribute(k, v) { attributes[k] = v; }, getAttribute(k) { return attributes[k] ?? null; },
      appendChild(child) { this.children.push(child); child.parentElement = this; },
      get firstChild() { return this.children[0] ?? null; },
      insertBefore(child, before) {
        if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(n => n !== child);
        const index = this.children.indexOf(before);
        this.children.splice(index < 0 ? this.children.length : index, 0, child);
        child.parentElement = this;
      },
      addEventListener(k, fn) { handlers[k] = fn; }, handlers,
      closest() { return null; }, getClientRects() { return this.hidden ? [] : [{}]; },
      click() { clicks.push(attributes['aria-label']); handlers.click?.({ preventDefault() {}, stopPropagation() {} }); },
    };
    elements.push(node);
    return node;
  };
  const controls = labels.map(label => { const node = element('button'); node.setAttribute('aria-label', label); return node; });
  let nav = element('ul');
  let player = { querySelectorAll() { return controls; } };
  const mediaHandlers = {};
  const navigator = { mediaSession: { setActionHandler(action, handler) {
    if (options.unsupportedMediaAction === action) throw new Error('Unsupported action');
    mediaHandlers[action] = handler;
  } } };
  let backs = 0;
  const history = { pushState() {}, replaceState() {}, back() { backs++; } };
  const document = { documentElement: element('html'), head: element('head'), body: element('body'),
    createElement: element, querySelector(selector) { return selector === '.NavHorizontal' ? nav : selector === '.Tuner .Tuner__Controls' ? player : null; }, querySelectorAll() { return controls; },
    addEventListener(k, fn) { listeners[k] = fn; },
  };
  const window = { location: { pathname }, history, addEventListener() {} };
  vm.runInNewContext(script, { document, window, history, navigator, setInterval(fn, delay) { intervals.push({ fn, delay }); } });
  return { controls, clicks, elements, history, window, mediaHandlers,
    removePlayer() { player = null; },
    clearPlayerControls() { player = { querySelectorAll() { return []; } }; },
    mediaTick() { intervals.filter(i => i.delay === 5000).forEach(i => i.fn()); },
    get nav() { return nav; },
    tick() { intervals.filter(i => i.delay === 500).forEach(i => i.fn()); },
    replaceNav() { nav = element('ul'); },
    backs: () => backs,
    key(overrides = {}) { let prevented = false; listeners.keydown({ key: 'ArrowUp', target: element('div'),
      preventDefault() { prevented = true; }, ...overrides }); return prevented; },
  };
}
test('Like cannot select Dislike, even if Dislike appears first', () => {
  const app = setup(['Dislike', 'Like']); assert.equal(app.key(), true); assert.deepEqual(app.clicks, ['Like']);
});
test('exact label wins over longer labels', () => {
  const app = setup(['Like this artist', 'Like']); app.key(); assert.deepEqual(app.clicks, ['Like']);
});
test('supports descriptive labels at a word boundary', () => {
  const app = setup(['Thumbs up this song']); app.key(); assert.deepEqual(app.clicks, ['Thumbs up this song']);
});
test('unavailable controls preserve arrow navigation', () => {
  for (const state of ['missing', 'disabled', 'hidden', 'aria-disabled']) {
    const app = setup(state === 'missing' ? [] : ['Like']);
    if (state === 'aria-disabled') app.controls[0].setAttribute(state, 'true');
    else if (state !== 'missing') app.controls[0][state] = true;
    assert.equal(app.key(), false); assert.deepEqual(app.clicks, []);
  }
});
test('modifiers, repeat, composition and handled events do not rate songs', () => {
  for (const flag of ['shiftKey', 'metaKey', 'ctrlKey', 'altKey', 'repeat', 'isComposing', 'defaultPrevented']) {
    const app = setup(['Like']); assert.equal(app.key({ [flag]: true }), false); assert.deepEqual(app.clicks, []);
  }
});
test('typing and arrow-driven widgets retain their keyboard behavior', () => {
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' },
    { isContentEditable: true }, { closest() { return {}; } }]) {
    const app = setup(['Like']); assert.equal(app.key({ target }), false); assert.deepEqual(app.clicks, []);
  }
});
test('down arrow selects negative feedback', () => {
  const app = setup(['Like', 'Dislike']); app.key({ key: 'ArrowDown' }); assert.deepEqual(app.clicks, ['Dislike']);
});
test('Back uses a native button and navigates backward', () => {
  const app = setup(); const button = app.elements.find(n => n.getAttribute('aria-label') === 'Back');
  assert.equal(button.tagName, 'BUTTON'); assert.equal(button.type, 'button');
  button.handlers.click({ preventDefault() {}, stopPropagation() {} }); assert.equal(app.backs(), 1);
});

test('Back becomes visible when navigation bypasses the wrapped history methods', () => {
  const app = setup([], '/station/play/123');
  const item = app.nav.firstChild;
  assert.equal(item.style.display, 'none');
  app.window.location.pathname = '/artist/ella-langley/dandelion/ALKm9Zhqw53bjv9';
  app.tick();
  assert.notEqual(item.style.display, 'none');
  assert.equal(app.nav.firstChild, item);
});
test('Back hides again on top-level routes even if Pandora replaces history methods', () => {
  const app = setup();
  app.history.pushState = () => { app.window.location.pathname = '/collection'; };
  app.history.pushState();
  app.tick();
  assert.equal(app.nav.firstChild.style.display, 'none');
});
test('Back returns when Pandora replaces the navigation element', () => {
  const app = setup();
  const item = app.nav.firstChild;
  app.replaceNav();
  app.tick();
  assert.equal(app.nav.firstChild, item);
  assert.notEqual(item.style.display, 'none');
  app.tick();
  assert.equal(app.nav.children.length, 1);
});

test('F7, F8 and F9 activate replay, play/pause and skip in the player', () => {
  for (const [key, label] of [['F7', 'Replay'], ['F8', 'Play'], ['F8', 'Pause'], ['F9', 'Skip forwards']]) {
    const app = setup([label]);
    assert.equal(app.key({ key }), true);
    assert.deepEqual(app.clicks, [label]);
  }
});
test('shortcuts never fall back to identically labeled history controls', () => {
  for (const key of ['F7', 'F8', 'F9', 'ArrowUp', 'ArrowDown']) {
    for (const state of ['missing', 'empty']) {
      const app = setup(['Replay', 'Play', 'Skip forwards', 'Thumb Up this song', 'Thumb Down this song']);
      if (state === 'missing') app.removePlayer(); else app.clearPlayerControls();
      assert.equal(app.key({ key }), false);
      assert.deepEqual(app.clicks, []);
    }
  }
});
test('all shortcuts ignore typing, modifiers, repeats and composition', () => {
  for (const key of ['F7', 'F8', 'F9', 'ArrowUp', 'ArrowDown']) {
    for (const exclusion of [{ target: { tagName: 'INPUT' } }, { target: { isContentEditable: true } },
      ...['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'repeat', 'isComposing', 'defaultPrevented'].map(flag => ({ [flag]: true }))]) {
      const app = setup(['Replay', 'Play', 'Skip forwards', 'Thumb Up this song', 'Thumb Down this song']);
      assert.equal(app.key({ key, ...exclusion }), false);
      assert.deepEqual(app.clicks, []);
    }
  }
});
test('media-session next and previous activate the correct controls', () => {
  const app = setup(['Replay', 'Skip forwards']);
  app.mediaHandlers.nexttrack();
  app.mediaHandlers.previoustrack();
  assert.deepEqual(app.clicks, ['Skip forwards', 'Replay']);
});
test('one unsupported media action does not disable other media keys', () => {
  const app = setup(['Replay'], '/', { unsupportedMediaAction: 'nexttrack' });
  app.mediaHandlers.previoustrack();
  assert.deepEqual(app.clicks, ['Replay']);
});
test('media handlers are restored after Pandora replaces them', () => {
  const app = setup(['Skip forwards']);
  app.mediaHandlers.nexttrack = () => {};
  app.mediaTick();
  app.mediaHandlers.nexttrack();
  assert.deepEqual(app.clicks, ['Skip forwards']);
});

test('Back consumes Enter and Space so Pandora cannot toggle playback', () => {
  for (const key of ['Enter', ' ']) {
    const app = setup();
    const button = app.elements.find(n => n.getAttribute('aria-label') === 'Back');
    let prevented = false, stopped = false;
    button.handlers.keydown({ key, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
    assert.equal(app.backs(), 1);
    assert.equal(prevented, true);
    assert.equal(stopped, true);
    button.handlers.keydown({ key, repeat: true, preventDefault() {}, stopPropagation() {} });
    assert.equal(app.backs(), 1);
  }
});
