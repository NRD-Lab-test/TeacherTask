
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.34.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/RedGreen.svelte generated by Svelte v3.34.0 */

    const file$8 = "src/RedGreen.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (28:8) {#each rangeGreen as i}
    function create_each_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "greenDot svelte-14oyo7v");
    			set_style(div, "left", Math.floor(/*i*/ ctx[10] / /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			set_style(div, "top", (/*stackSize*/ ctx[2] - /*i*/ ctx[10] % /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			set_style(div, "width", /*ballSize*/ ctx[3] + "px");
    			set_style(div, "height", /*ballSize*/ ctx[3] + "px");
    			set_style(div, "position", "absolute");
    			add_location(div, file$8, 28, 12, 798);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rangeGreen*/ 1) {
    				set_style(div, "left", Math.floor(/*i*/ ctx[10] / /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			}

    			if (dirty & /*rangeGreen*/ 1) {
    				set_style(div, "top", (/*stackSize*/ ctx[2] - /*i*/ ctx[10] % /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(28:8) {#each rangeGreen as i}",
    		ctx
    	});

    	return block;
    }

    // (37:8) {#each rangeRed as j}
    function create_each_block$3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "redDot svelte-14oyo7v");
    			set_style(div, "left", Math.floor(/*j*/ ctx[7] / /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			set_style(div, "top", (/*stackSize*/ ctx[2] - /*j*/ ctx[7] % /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			set_style(div, "width", /*ballSize*/ ctx[3] + "px");
    			set_style(div, "height", /*ballSize*/ ctx[3] + "px");
    			set_style(div, "position", "absolute");
    			add_location(div, file$8, 37, 12, 1372);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rangeRed*/ 2) {
    				set_style(div, "left", Math.floor(/*j*/ ctx[7] / /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			}

    			if (dirty & /*rangeRed*/ 2) {
    				set_style(div, "top", (/*stackSize*/ ctx[2] - /*j*/ ctx[7] % /*stackSize*/ ctx[2]) * /*ballSize*/ ctx[3] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(37:8) {#each rangeRed as j}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div2;
    	let div1;
    	let h0;
    	let t1;
    	let div0;
    	let t2;
    	let t3;
    	let div5;
    	let div4;
    	let h1;
    	let t5;
    	let div3;
    	let t6;
    	let each_value_1 = /*rangeGreen*/ ctx[0];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*rangeRed*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			h0 = element("h");
    			h0.textContent = "Green Light Students";
    			t1 = space();
    			div0 = element("div");
    			t2 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t3 = space();
    			div5 = element("div");
    			div4 = element("div");
    			h1 = element("h");
    			h1.textContent = "Red Light Students";
    			t5 = space();
    			div3 = element("div");
    			t6 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			set_style(h0, "width", "200px");
    			set_style(h0, "color", "black");
    			add_location(h0, file$8, 25, 8, 583);
    			set_style(div0, "left", "-5px");
    			set_style(div0, "width", "205px");
    			set_style(div0, "height", "300px");
    			set_style(div0, "border", "solid black 1px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$8, 26, 8, 655);
    			set_style(div1, "left", "10px");
    			set_style(div1, "width", "200px");
    			set_style(div1, "height", "0px");
    			set_style(div1, "position", "absolute");
    			set_style(div1, "text-align", "center");
    			add_location(div1, file$8, 24, 4, 485);
    			add_location(div2, file$8, 23, 4, 475);
    			set_style(h1, "width", "120px");
    			set_style(h1, "color", "black");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$8, 34, 8, 1142);
    			set_style(div3, "left", "-5px");
    			set_style(div3, "width", "205px");
    			set_style(div3, "height", "300px");
    			set_style(div3, "border", "solid black 1px");
    			set_style(div3, "position", "absolute");
    			add_location(div3, file$8, 35, 8, 1231);
    			set_style(div4, "left", "220px");
    			set_style(div4, "width", "200px");
    			set_style(div4, "height", "100px");
    			set_style(div4, "position", "absolute");
    			set_style(div4, "text-align", "center");
    			add_location(div4, file$8, 33, 4, 1041);
    			add_location(div5, file$8, 32, 4, 1031);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, h0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div1, t2);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			insert_dev(target, t3, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, h1);
    			append_dev(div4, t5);
    			append_dev(div4, div3);
    			append_dev(div4, t6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div4, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Math, rangeGreen, stackSize, ballSize*/ 13) {
    				each_value_1 = /*rangeGreen*/ ctx[0];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*Math, rangeRed, stackSize, ballSize*/ 14) {
    				each_value = /*rangeRed*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div4, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div5);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let numberRed;
    	let rangeGreen;
    	let rangeRed;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("RedGreen", slots, []);
    	let { numberGreen = 0 } = $$props;
    	let { clearBoard = false } = $$props;

    	if (!numberRed) {
    		numberRed = 20 - numberGreen;
    	}

    	let stackSize = 5;
    	let ballSize = 50;
    	const writable_props = ["numberGreen", "clearBoard"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<RedGreen> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("numberGreen" in $$props) $$invalidate(4, numberGreen = $$props.numberGreen);
    		if ("clearBoard" in $$props) $$invalidate(5, clearBoard = $$props.clearBoard);
    	};

    	$$self.$capture_state = () => ({
    		numberGreen,
    		clearBoard,
    		stackSize,
    		ballSize,
    		numberRed,
    		rangeGreen,
    		rangeRed
    	});

    	$$self.$inject_state = $$props => {
    		if ("numberGreen" in $$props) $$invalidate(4, numberGreen = $$props.numberGreen);
    		if ("clearBoard" in $$props) $$invalidate(5, clearBoard = $$props.clearBoard);
    		if ("stackSize" in $$props) $$invalidate(2, stackSize = $$props.stackSize);
    		if ("ballSize" in $$props) $$invalidate(3, ballSize = $$props.ballSize);
    		if ("numberRed" in $$props) $$invalidate(6, numberRed = $$props.numberRed);
    		if ("rangeGreen" in $$props) $$invalidate(0, rangeGreen = $$props.rangeGreen);
    		if ("rangeRed" in $$props) $$invalidate(1, rangeRed = $$props.rangeRed);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*clearBoard, numberGreen*/ 48) {
    			$$invalidate(6, numberRed = !clearBoard ? 20 - numberGreen : 0);
    		}

    		if ($$self.$$.dirty & /*numberGreen*/ 16) {
    			$$invalidate(0, rangeGreen = [...Array(numberGreen).keys()]);
    		}

    		if ($$self.$$.dirty & /*numberRed*/ 64) {
    			$$invalidate(1, rangeRed = [...Array(numberRed).keys()]);
    		}
    	};

    	return [rangeGreen, rangeRed, stackSize, ballSize, numberGreen, clearBoard, numberRed];
    }

    class RedGreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { numberGreen: 4, clearBoard: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RedGreen",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get numberGreen() {
    		throw new Error("<RedGreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set numberGreen(value) {
    		throw new Error("<RedGreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get clearBoard() {
    		throw new Error("<RedGreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clearBoard(value) {
    		throw new Error("<RedGreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Game.svelte generated by Svelte v3.34.0 */

    const { console: console_1$4 } = globals;
    const file$7 = "src/Game.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[32] = list[i];
    	return child_ctx;
    }

    // (262:0) {#key trial}
    function create_key_block_1(ctx) {
    	let h10;
    	let t0;
    	let t1_value = Math.round(/*currentUnderstanding*/ ctx[9] / 20 * 100) + "";
    	let t1;
    	let t2;
    	let t3;
    	let h11;
    	let t4;
    	let t5;
    	let t6;

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			t0 = text("Current Classroom Understanding: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    			t3 = space();
    			h11 = element("h1");
    			t4 = text(/*trial*/ ctx[11]);
    			t5 = text(" of ");
    			t6 = text(/*numTrials*/ ctx[12]);
    			set_style(h10, "position", "absolute");
    			set_style(h10, "top", "0vh");
    			set_style(h10, "left", "calc(50vw + -400px)");
    			set_style(h10, "width", "800px");
    			set_style(h10, "height", "50px");
    			set_style(h10, "text-align", "center");
    			set_style(h10, "border", "solid black 2px");
    			add_location(h10, file$7, 262, 0, 8572);
    			set_style(h11, "position", "absolute");
    			set_style(h11, "top", "0vh");
    			set_style(h11, "left", "calc(100vw + -210px)");
    			set_style(h11, "width", "200px");
    			set_style(h11, "height", "50px");
    			set_style(h11, "text-align", "center");
    			set_style(h11, "border", "solid black 2px");
    			add_location(h11, file$7, 263, 0, 8788);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			append_dev(h10, t0);
    			append_dev(h10, t1);
    			append_dev(h10, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, h11, anchor);
    			append_dev(h11, t4);
    			append_dev(h11, t5);
    			append_dev(h11, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*currentUnderstanding*/ 512 && t1_value !== (t1_value = Math.round(/*currentUnderstanding*/ ctx[9] / 20 * 100) + "")) set_data_dev(t1, t1_value);
    			if (dirty[0] & /*trial*/ 2048) set_data_dev(t4, /*trial*/ ctx[11]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(h11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_1.name,
    		type: "key",
    		source: "(262:0) {#key trial}",
    		ctx
    	});

    	return block;
    }

    // (268:8) {#if counter<numTrials}
    function create_if_block$7(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let t;
    	let current;
    	const if_block_creators = [create_if_block_1$6, create_else_block_1$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[32] == 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t = space();
    			set_style(div, "position", "absolute");
    			set_style(div, "top", "25vh");
    			set_style(div, "left", "calc(" + (/*i*/ ctx[32] + 1) * Math.round(/*viewPortScale*/ ctx[13] / (/*viewNumber*/ ctx[10] + 1)) + "vw - 215px)");
    			add_location(div, file$7, 268, 16, 9045);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			append_dev(div, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(268:8) {#if counter<numTrials}",
    		ctx
    	});

    	return block;
    }

    // (287:16) {:else}
    function create_else_block_1$2(ctx) {
    	let h1;
    	let t1;
    	let div1;
    	let div0;
    	let current_block_type_index;
    	let if_block0;
    	let div1_id_value;
    	let div1_intro;
    	let div1_outro;
    	let t2;
    	let div2;
    	let t3;
    	let if_block1_anchor;
    	let current;
    	const if_block_creators = [create_if_block_5$2, create_else_block_2$2];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*viewExplore*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[7] && create_if_block_4$3(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "New Teaching Move";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			if_block0.c();
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			set_style(h1, "top", "-100px");
    			set_style(h1, "width", "430px");
    			set_style(h1, "height", "5px");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$7, 287, 16, 10501);
    			set_style(div0, "top", "50px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$7, 289, 20, 10899);
    			attr_dev(div1, "class", "greyBox svelte-a980so");
    			attr_dev(div1, "id", div1_id_value = `box2: ${/*counter*/ ctx[0]}`);
    			set_style(div1, "width", /*blockSize*/ ctx[14]);
    			set_style(div1, "top", "50px");
    			set_style(div1, "height", /*blockSize*/ ctx[14]);
    			set_style(div1, "border", "solid black 3px");
    			set_style(div1, "margin", "0px");
    			add_location(div1, file$7, 288, 16, 10629);
    			set_style(div2, "width", 450 + "px");
    			set_style(div2, "height", 450 + "px");
    			set_style(div2, "border", "solid blue 5px");
    			set_style(div2, "opacity", !/*exploreSelect*/ ctx[4] ? "0" : "1");
    			set_style(div2, "top", "37px");
    			set_style(div2, "left", "-12px");
    			set_style(div2, "position", "absolute");
    			add_location(div2, file$7, 297, 17, 11279);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div2, anchor);
    			insert_dev(target, t3, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block0 = if_blocks[current_block_type_index];

    				if (!if_block0) {
    					if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block0.c();
    				} else {
    					if_block0.p(ctx, dirty);
    				}

    				transition_in(if_block0, 1);
    				if_block0.m(div0, null);
    			}

    			if (!current || dirty[0] & /*counter*/ 1 && div1_id_value !== (div1_id_value = `box2: ${/*counter*/ ctx[0]}`)) {
    				attr_dev(div1, "id", div1_id_value);
    			}

    			if (!current || dirty[0] & /*exploreSelect*/ 16) {
    				set_style(div2, "opacity", !/*exploreSelect*/ ctx[4] ? "0" : "1");
    			}

    			if (/*keyView*/ ctx[7]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_4$3(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);

    			add_render_callback(() => {
    				if (div1_outro) div1_outro.end(1);

    				if (!div1_intro) div1_intro = create_in_transition(div1, /*migrateLeftExplore*/ ctx[16], {
    					replaceExploit: /*replaceExploit*/ ctx[6]
    				});

    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div1_intro) div1_intro.invalidate();

    			div1_outro = create_out_transition(div1, /*InvisibleOrDown*/ ctx[19], {
    				replaceExploit: /*replaceExploit*/ ctx[6]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div1_outro) div1_outro.end();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t3);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(287:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (270:16) {#if i==0}
    function create_if_block_1$6(ctx) {
    	let h1;
    	let t1;
    	let div0;
    	let t2;
    	let div2;
    	let div1;
    	let current_block_type_index;
    	let if_block0;
    	let div2_id_value;
    	let div2_intro;
    	let div2_outro;
    	let t3;
    	let if_block1_anchor;
    	let current;
    	const if_block_creators = [create_if_block_3$4, create_else_block$4];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*clearBoard*/ ctx[8]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[7] && create_if_block_2$6(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Current Teaching Move";
    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			set_style(h1, "top", "-100px");
    			set_style(h1, "width", "430px");
    			set_style(h1, "height", "5px");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$7, 270, 16, 9204);
    			set_style(div0, "width", 450 + "px");
    			set_style(div0, "height", 450 + "px");
    			set_style(div0, "border", "solid blue 5px");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[5] ? "0" : "1");
    			set_style(div0, "top", "37px");
    			set_style(div0, "left", "-12px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$7, 271, 16, 9335);
    			set_style(div1, "top", "50px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$7, 273, 24, 9779);
    			attr_dev(div2, "class", "greyBox svelte-a980so");
    			attr_dev(div2, "id", div2_id_value = `box1: ${/*counter*/ ctx[0]}`);
    			set_style(div2, "width", /*blockSize*/ ctx[14]);
    			set_style(div2, "top", "50px");
    			set_style(div2, "height", /*blockSize*/ ctx[14]);
    			set_style(div2, "border", "solid black 3px");
    			set_style(div2, "margin", "0px");
    			add_location(div2, file$7, 272, 20, 9507);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			insert_dev(target, t3, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty[0] & /*exploitSelect*/ 32) {
    				set_style(div0, "opacity", !/*exploitSelect*/ ctx[5] ? "0" : "1");
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block0 = if_blocks[current_block_type_index];

    				if (!if_block0) {
    					if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block0.c();
    				} else {
    					if_block0.p(ctx, dirty);
    				}

    				transition_in(if_block0, 1);
    				if_block0.m(div1, null);
    			}

    			if (!current || dirty[0] & /*counter*/ 1 && div2_id_value !== (div2_id_value = `box1: ${/*counter*/ ctx[0]}`)) {
    				attr_dev(div2, "id", div2_id_value);
    			}

    			if (/*keyView*/ ctx[7]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_2$6(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);

    			add_render_callback(() => {
    				if (div2_outro) div2_outro.end(1);

    				if (!div2_intro) div2_intro = create_in_transition(div2, /*migrateLeftExploit*/ ctx[17], {
    					replaceExploit: /*replaceExploit*/ ctx[6]
    				});

    				div2_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div2_intro) div2_intro.invalidate();

    			div2_outro = create_out_transition(div2, /*migrateOut*/ ctx[18], {
    				replaceExploit: /*replaceExploit*/ ctx[6]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div2);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div2_outro) div2_outro.end();
    			if (detaching) detach_dev(t3);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$6.name,
    		type: "if",
    		source: "(270:16) {#if i==0}",
    		ctx
    	});

    	return block;
    }

    // (293:24) {:else}
    function create_else_block_2$2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "?";
    			set_style(div, "width", "430px");
    			set_style(div, "text-align", "center");
    			set_style(div, "font-size", "200px");
    			add_location(div, file$7, 293, 28, 11109);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$2.name,
    		type: "else",
    		source: "(293:24) {:else}",
    		ctx
    	});

    	return block;
    }

    // (291:24) {#if viewExplore}
    function create_if_block_5$2(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploreMu*/ ctx[3] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploreMu*/ 8) redgreen_changes.numberGreen = /*exploreMu*/ ctx[3];
    			redgreen.$set(redgreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5$2.name,
    		type: "if",
    		source: "(291:24) {#if viewExplore}",
    		ctx
    	});

    	return block;
    }

    // (299:12) {#if keyView}
    function create_if_block_4$3(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Right Arrow";
    			set_style(h2, "width", "200px");
    			set_style(h2, "border", "solid black 3px");
    			set_style(h2, "text-align", "center");
    			add_location(h2, file$7, 300, 20, 11602);
    			set_style(div, "top", "500px");
    			set_style(div, "left", "0px");
    			set_style(div, "width", "430px");
    			set_style(div, "display", "flex");
    			set_style(div, "justify-content", "center");
    			set_style(div, "position", "absolute");
    			add_location(div, file$7, 299, 17, 11474);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$3.name,
    		type: "if",
    		source: "(299:12) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (277:28) {:else}
    function create_else_block$4(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: 0, clearBoard: true },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(277:28) {:else}",
    		ctx
    	});

    	return block;
    }

    // (275:28) {#if !clearBoard}
    function create_if_block_3$4(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploitMu*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploitMu*/ 4) redgreen_changes.numberGreen = /*exploitMu*/ ctx[2];
    			redgreen.$set(redgreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$4.name,
    		type: "if",
    		source: "(275:28) {#if !clearBoard}",
    		ctx
    	});

    	return block;
    }

    // (282:16) {#if keyView}
    function create_if_block_2$6(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Left Arrow";
    			set_style(h2, "width", "200px");
    			set_style(h2, "border", "solid black 3px");
    			set_style(h2, "text-align", "center");
    			add_location(h2, file$7, 283, 24, 10325);
    			set_style(div, "top", "500px");
    			set_style(div, "left", "0px");
    			set_style(div, "width", "430px");
    			set_style(div, "display", "flex");
    			set_style(div, "justify-content", "center");
    			set_style(div, "position", "absolute");
    			add_location(div, file$7, 282, 20, 10193);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$6.name,
    		type: "if",
    		source: "(282:16) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (267:4) {#each range as i}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*counter*/ ctx[0] < /*numTrials*/ ctx[12] && create_if_block$7(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*counter*/ ctx[0] < /*numTrials*/ ctx[12]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*counter*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$7(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(267:4) {#each range as i}",
    		ctx
    	});

    	return block;
    }

    // (266:0) {#key counter}
    function create_key_block$2(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*range*/ ctx[15];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*range, viewPortScale, viewNumber, keyView, counter, blockSize, replaceExploit, exploitMu, clearBoard, exploitSelect, exploreSelect, exploreMu, viewExplore, numTrials*/ 62975) {
    				each_value = /*range*/ ctx[15];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block$2.name,
    		type: "key",
    		source: "(266:0) {#key counter}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let previous_key = /*trial*/ ctx[11];
    	let t;
    	let previous_key_1 = /*counter*/ ctx[0];
    	let key_block1_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let key_block0 = create_key_block_1(ctx);
    	let key_block1 = create_key_block$2(ctx);

    	const block = {
    		c: function create() {
    			key_block0.c();
    			t = space();
    			key_block1.c();
    			key_block1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			key_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			key_block1.m(target, anchor);
    			insert_dev(target, key_block1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", /*handleKeydown*/ ctx[20], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*trial*/ 2048 && safe_not_equal(previous_key, previous_key = /*trial*/ ctx[11])) {
    				key_block0.d(1);
    				key_block0 = create_key_block_1(ctx);
    				key_block0.c();
    				key_block0.m(t.parentNode, t);
    			} else {
    				key_block0.p(ctx, dirty);
    			}

    			if (dirty[0] & /*counter*/ 1 && safe_not_equal(previous_key_1, previous_key_1 = /*counter*/ ctx[0])) {
    				group_outros();
    				transition_out(key_block1, 1, 1, noop);
    				check_outros();
    				key_block1 = create_key_block$2(ctx);
    				key_block1.c();
    				transition_in(key_block1);
    				key_block1.m(key_block1_anchor.parentNode, key_block1_anchor);
    			} else {
    				key_block1.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(key_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(key_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			key_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(key_block1_anchor);
    			key_block1.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function timer$3(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    async function Send_Data_To_Exius$2(params, templateKey, writeKey) {
    	// [{endpoint:Horizon_CSV,data:data,fname:fname}]
    	try {
    		var fd = new FormData();

    		for (const fileInfo of params) {
    			let URL = new Blob([fileInfo.data], { type: "text/csv;charset=utf-8;" });
    			fd.append(fileInfo.endpoint, URL, fileInfo.fname);
    		}

    		let res = await fetch("https://exius.nrdlab.org/Upload", {
    			headers: {
    				authorization: `templateKey:${templateKey};writeKey:${writeKey}`
    			},
    			method: "POST",
    			body: fd
    		});

    		return await res.json();
    	} catch(e) {
    		throw e;
    	}
    }

    function box_mueller$1() {
    	// all credit to stack exhange
    	var u = 0, v = 0;

    	while (u === 0) u = Math.random();
    	while (v === 0) v = Math.random();
    	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function sample_normal$1(mu, sd) {
    	return sd * box_mueller$1() + mu;
    }

    function random_int$1() {
    	return Math.floor(20 * Math.random());
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Game", slots, []);
    	let { counter = 0 } = $$props;
    	const viewNumber = 2;
    	let trialSd = 3;
    	let numTrials = 300;
    	let trial = 1;
    	let trialData = [];
    	let viewPortScale = 100;
    	let blockSize = "430px";
    	let { gameString = "" } = $$props;
    	let range = [...Array(viewNumber).keys()];
    	let trialStartTime = Date.now();
    	let { viewExplore = false } = $$props;
    	let { exploitMu = random_int$1() } = $$props;
    	let { exploreMu = random_int$1() } = $$props;
    	let { exploreSelect = false } = $$props;
    	let { exploitSelect = false } = $$props;
    	let { replaceExploit = { truth: false } } = $$props;
    	let { keyView = true } = $$props;
    	let { clearBoard = false } = $$props;
    	let { currentUnderstanding = exploitMu } = $$props;
    	let { toDebrief } = $$props;
    	let { writeKey } = $$props;
    	let { id } = $$props;
    	let bothInvisible = true;
    	console.log(gameString);

    	//$: oldExploit =replaceExploit
    	function migrateLeftExplore(node, { delay = 0, duration = 500 }) {
    		if (bothInvisible) {
    			return { delay: 0, duration: 0 };
    		}

    		console.log(`migrateLeftExplore:${true}`);

    		return {
    			delay,
    			duration,
    			css: (t, u) => `transform: translateX(calc(${100 * u}vw)) `
    		};
    	}

    	function migrateLeftExploit(node, { replaceExploit, delay = 0, duration = 500 }) {
    		if (bothInvisible) {
    			return { delay: 0, duration: 0 };
    		}

    		console.log(`migrateLeftExploit:${replaceExploit}`);

    		if (replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateX(calc(${viewPortScale / (viewNumber + 1) * u}vw)) `
    			};
    		} else {
    			return {};
    		}
    	}

    	function migrateOut(node, { replaceExploit, delay = 0, duration = 500 }) {
    		if (bothInvisible) {
    			return { delay: 0, duration: 0 };
    		}

    		console.log(`migrateOut:${replaceExploit}`);

    		if (replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateX(calc(${-100 * u}vw)) `
    			};
    		} else {
    			return {};
    		}
    	}

    	function InvisibleOrDown(node, { replaceExploit, delay = 0, duration = 500 }) {
    		if (bothInvisible) {
    			return { delay: 0, duration: 0 };
    		}

    		console.log(`invisibleOrDown:${replaceExploit}`);

    		if (!replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateY(calc(${100 * u}vh)) `
    			};
    		} else {
    			return {
    				css: () => `visibility: hidden;display: none;`
    			};
    		}
    	}

    	async function handleKeydown(event) {
    		console.log(event.key);

    		if (keyView == false) {
    			return;
    		}

    		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    			let singleTrialData = {
    				trial: trial.toString(),
    				previousExploit: exploitMu,
    				keyPressTime: Date.now(),
    				trialStartTime
    			};

    			bothInvisible = false;

    			if (event.key == "ArrowLeft") {
    				$$invalidate(7, keyView = false);
    				let newDist = sample_normal_to_twenty();
    				singleTrialData["newExploit"] = newDist;
    				singleTrialData["choice"] = "exploit";
    				singleTrialData["exploreSeen"] = undefined;
    				$$invalidate(5, exploitSelect = true);
    				await timer$3(500);
    				$$invalidate(5, exploitSelect = false);
    				$$invalidate(8, clearBoard = true);
    				singleTrialData["exploitBoardClear"] = Date.now();
    				await timer$3(1000);
    				$$invalidate(2, exploitMu = newDist);
    				$$invalidate(8, clearBoard = false);
    				$$invalidate(7, keyView = true);
    				singleTrialData["newExploitBoard"] = Date.now();
    				trialStartTime = Date.now();
    				$$invalidate(9, currentUnderstanding = newDist);
    				$$invalidate(11, trial += 1);
    				console.log("done");
    			}

    			if (event.key == "ArrowRight") {
    				$$invalidate(1, viewExplore = true);
    				let newDist = random_int$1();
    				singleTrialData["choice"] = "explore";
    				singleTrialData["exploreSeen"] = newDist;

    				if (newDist > exploitMu) {
    					singleTrialData["newExploit"] = newDist;
    					console.log("greater than");
    					$$invalidate(7, keyView = false);
    					$$invalidate(3, exploreMu = newDist);
    					$$invalidate(4, exploreSelect = true);
    					singleTrialData["newExploreVisible"] = Date.now();
    					await timer$3(500);
    					$$invalidate(4, exploreSelect = false);
    					singleTrialData["newExploreDeslected"] = Date.now();
    					await timer$3(500);
    					$$invalidate(2, exploitMu = newDist);
    					$$invalidate(1, viewExplore = false);
    					$$invalidate(6, replaceExploit.truth = true, replaceExploit);
    					$$invalidate(0, counter += 1);
    					singleTrialData["newExploreMove"] = Date.now();
    					await timer$3(500);
    					$$invalidate(7, keyView = true);
    					singleTrialData["exploreFinishedMoving"] = Date.now();
    					trialStartTime = Date.now();
    					$$invalidate(9, currentUnderstanding = newDist);
    					$$invalidate(11, trial += 1);
    				} else {
    					console.log("less than");
    					$$invalidate(7, keyView = false);
    					singleTrialData["newExploit"] = null;
    					$$invalidate(3, exploreMu = newDist);
    					$$invalidate(4, exploreSelect = true);
    					singleTrialData["newExploreVisible"] = Date.now();
    					await timer$3(500);
    					$$invalidate(4, exploreSelect = false);
    					singleTrialData["newExploreDeselected"] = Date.now();
    					await timer$3(500);
    					singleTrialData["newExploreMove"] = Date.now();
    					$$invalidate(1, viewExplore = false);
    					$$invalidate(6, replaceExploit.truth = false, replaceExploit);
    					$$invalidate(0, counter += 1);
    					await timer$3(500);
    					$$invalidate(7, keyView = true);
    					singleTrialData["exploreFinishedMoving"] = Date.now();
    					trialStartTime = Date.now();
    					$$invalidate(9, currentUnderstanding = newDist);
    					$$invalidate(11, trial += 1);
    				}
    			}

    			bothInvisible = false;
    			export_data(singleTrialData);

    			if (trial === numTrials + 1) {
    				toDebrief();
    			}
    		}
    	}

    	function sample_normal_to_twenty() {
    		let newNorm = Math.floor(sample_normal$1(exploitMu, trialSd));
    		newNorm = Math.min(newNorm, 20);
    		newNorm = Math.max(newNorm, 0);
    		return newNorm;
    	}

    	function export_data(data) {
    		let iterate_keys = [
    			"trial",
    			"previousExploit",
    			"keyPressTime",
    			"trialStartTime",
    			"choice",
    			"newExploit",
    			"exploreSeen",
    			"exploitBoardClear",
    			"newExploitBoard",
    			"newExploreVisible",
    			"newExploreDeselected",
    			"newExploreMove",
    			"exploreFinishedMoving"
    		];

    		let trialString = "";

    		for (const key of iterate_keys) {
    			trialString += `${data[key]},`;
    		}

    		$$invalidate(21, gameString += trialString.substring(0, trialString.length - 1) + "\n");

    		if (trial % 5 === 0) {
    			sendData();
    		}
    	}

    	async function sendData() {
    		console.log(await Send_Data_To_Exius$2(
    			[
    				{
    					endpoint: "TeacherCSV",
    					fname: `Subject_${id}.csv`,
    					data: gameString
    				}
    			],
    			"Teacher_Task",
    			writeKey
    		));
    	}

    	const writable_props = [
    		"counter",
    		"gameString",
    		"viewExplore",
    		"exploitMu",
    		"exploreMu",
    		"exploreSelect",
    		"exploitSelect",
    		"replaceExploit",
    		"keyView",
    		"clearBoard",
    		"currentUnderstanding",
    		"toDebrief",
    		"writeKey",
    		"id"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$4.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("gameString" in $$props) $$invalidate(21, gameString = $$props.gameString);
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(3, exploreMu = $$props.exploreMu);
    		if ("exploreSelect" in $$props) $$invalidate(4, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(5, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(6, replaceExploit = $$props.replaceExploit);
    		if ("keyView" in $$props) $$invalidate(7, keyView = $$props.keyView);
    		if ("clearBoard" in $$props) $$invalidate(8, clearBoard = $$props.clearBoard);
    		if ("currentUnderstanding" in $$props) $$invalidate(9, currentUnderstanding = $$props.currentUnderstanding);
    		if ("toDebrief" in $$props) $$invalidate(22, toDebrief = $$props.toDebrief);
    		if ("writeKey" in $$props) $$invalidate(23, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(24, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		RedGreen,
    		counter,
    		viewNumber,
    		trialSd,
    		numTrials,
    		trial,
    		trialData,
    		viewPortScale,
    		blockSize,
    		gameString,
    		range,
    		trialStartTime,
    		viewExplore,
    		exploitMu,
    		exploreMu,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		keyView,
    		clearBoard,
    		currentUnderstanding,
    		toDebrief,
    		writeKey,
    		id,
    		bothInvisible,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		timer: timer$3,
    		Send_Data_To_Exius: Send_Data_To_Exius$2,
    		handleKeydown,
    		box_mueller: box_mueller$1,
    		sample_normal: sample_normal$1,
    		sample_normal_to_twenty,
    		random_int: random_int$1,
    		export_data,
    		sendData
    	});

    	$$self.$inject_state = $$props => {
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("trialSd" in $$props) trialSd = $$props.trialSd;
    		if ("numTrials" in $$props) $$invalidate(12, numTrials = $$props.numTrials);
    		if ("trial" in $$props) $$invalidate(11, trial = $$props.trial);
    		if ("trialData" in $$props) trialData = $$props.trialData;
    		if ("viewPortScale" in $$props) $$invalidate(13, viewPortScale = $$props.viewPortScale);
    		if ("blockSize" in $$props) $$invalidate(14, blockSize = $$props.blockSize);
    		if ("gameString" in $$props) $$invalidate(21, gameString = $$props.gameString);
    		if ("range" in $$props) $$invalidate(15, range = $$props.range);
    		if ("trialStartTime" in $$props) trialStartTime = $$props.trialStartTime;
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(3, exploreMu = $$props.exploreMu);
    		if ("exploreSelect" in $$props) $$invalidate(4, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(5, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(6, replaceExploit = $$props.replaceExploit);
    		if ("keyView" in $$props) $$invalidate(7, keyView = $$props.keyView);
    		if ("clearBoard" in $$props) $$invalidate(8, clearBoard = $$props.clearBoard);
    		if ("currentUnderstanding" in $$props) $$invalidate(9, currentUnderstanding = $$props.currentUnderstanding);
    		if ("toDebrief" in $$props) $$invalidate(22, toDebrief = $$props.toDebrief);
    		if ("writeKey" in $$props) $$invalidate(23, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(24, id = $$props.id);
    		if ("bothInvisible" in $$props) bothInvisible = $$props.bothInvisible;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		counter,
    		viewExplore,
    		exploitMu,
    		exploreMu,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		keyView,
    		clearBoard,
    		currentUnderstanding,
    		viewNumber,
    		trial,
    		numTrials,
    		viewPortScale,
    		blockSize,
    		range,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		handleKeydown,
    		gameString,
    		toDebrief,
    		writeKey,
    		id
    	];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$9,
    			create_fragment$9,
    			safe_not_equal,
    			{
    				counter: 0,
    				viewNumber: 10,
    				gameString: 21,
    				viewExplore: 1,
    				exploitMu: 2,
    				exploreMu: 3,
    				exploreSelect: 4,
    				exploitSelect: 5,
    				replaceExploit: 6,
    				keyView: 7,
    				clearBoard: 8,
    				currentUnderstanding: 9,
    				toDebrief: 22,
    				writeKey: 23,
    				id: 24
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*toDebrief*/ ctx[22] === undefined && !("toDebrief" in props)) {
    			console_1$4.warn("<Game> was created without expected prop 'toDebrief'");
    		}

    		if (/*writeKey*/ ctx[23] === undefined && !("writeKey" in props)) {
    			console_1$4.warn("<Game> was created without expected prop 'writeKey'");
    		}

    		if (/*id*/ ctx[24] === undefined && !("id" in props)) {
    			console_1$4.warn("<Game> was created without expected prop 'id'");
    		}
    	}

    	get counter() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set counter(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewNumber() {
    		return this.$$.ctx[10];
    	}

    	set viewNumber(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get gameString() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set gameString(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewExplore() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set viewExplore(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitMu() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitMu(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploreMu() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploreMu(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploreSelect() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploreSelect(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitSelect() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitSelect(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replaceExploit() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replaceExploit(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get keyView() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set keyView(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get clearBoard() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clearBoard(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get currentUnderstanding() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentUnderstanding(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toDebrief() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toDebrief(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get writeKey() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set writeKey(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/NavigationButtons.svelte generated by Svelte v3.34.0 */

    const file$6 = "src/Instructions/NavigationButtons.svelte";

    // (23:0) {#if !breakTruth.truth && display}
    function create_if_block$6(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*nextInstruction*/ ctx[1] && /*previousInstruction*/ ctx[2]) return create_if_block_1$5;
    		if (/*nextInstruction*/ ctx[1]) return create_if_block_2$5;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(23:0) {#if !breakTruth.truth && display}",
    		ctx
    	});

    	return block;
    }

    // (29:4) {:else}
    function create_else_block$3(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Back: B";
    			set_style(h1, "position", "absolute");
    			set_style(h1, "left", "calc(50vw + -200px)");
    			set_style(h1, "top", "calc(100vh + -100px)");
    			set_style(h1, "width", "400px");
    			set_style(h1, "height", "50px");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "border", "solid black 2px");
    			add_location(h1, file$6, 29, 8, 1259);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(29:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (27:30) 
    function create_if_block_2$5(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Next: Space";
    			set_style(h1, "position", "absolute");
    			set_style(h1, "left", "calc(50vw + -200px)");
    			set_style(h1, "top", "calc(100vh + -100px)");
    			set_style(h1, "width", "400px");
    			set_style(h1, "height", "50px");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "border", "solid black 2px");
    			add_location(h1, file$6, 27, 8, 1066);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$5.name,
    		type: "if",
    		source: "(27:30) ",
    		ctx
    	});

    	return block;
    }

    // (24:4) {#if nextInstruction && previousInstruction}
    function create_if_block_1$5(ctx) {
    	let h10;
    	let t1;
    	let h11;

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "Back: B";
    			t1 = space();
    			h11 = element("h1");
    			h11.textContent = "Next: Space";
    			set_style(h10, "position", "absolute");
    			set_style(h10, "left", "calc(25vw + -200px)");
    			set_style(h10, "top", "calc(100vh + -100px)");
    			set_style(h10, "width", "400px");
    			set_style(h10, "height", "50px");
    			set_style(h10, "text-align", "center");
    			set_style(h10, "border", "solid black 2px");
    			add_location(h10, file$6, 24, 8, 681);
    			set_style(h11, "position", "absolute");
    			set_style(h11, "left", "calc(75vw + -200px)");
    			set_style(h11, "top", "calc(100vh + -100px)");
    			set_style(h11, "width", "400px");
    			set_style(h11, "height", "50px");
    			set_style(h11, "text-align", "center");
    			set_style(h11, "border", "solid black 2px");
    			add_location(h11, file$6, 25, 8, 855);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h11, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(24:4) {#if nextInstruction && previousInstruction}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = !/*breakTruth*/ ctx[0].truth && /*display*/ ctx[3] && create_if_block$6(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", /*handleKeydown*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*breakTruth*/ ctx[0].truth && /*display*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("NavigationButtons", slots, []);
    	let { breakTruth = { truth: false } } = $$props;
    	let { nextInstruction = null } = $$props;
    	let { previousInstruction = null } = $$props;
    	let { forwardKey = " " } = $$props;
    	let { backKey = "b" } = $$props;
    	let { backSkip = 1 } = $$props;
    	let { forwardSkip = 1 } = $$props;
    	let { display = true } = $$props;

    	function handleKeydown(e) {
    		if (breakTruth.truth) {
    			return;
    		}

    		if (e.key === forwardKey) {
    			nextInstruction(forwardSkip);
    		}

    		if (e.key === backKey) {
    			previousInstruction(backSkip);
    		}
    	}

    	const writable_props = [
    		"breakTruth",
    		"nextInstruction",
    		"previousInstruction",
    		"forwardKey",
    		"backKey",
    		"backSkip",
    		"forwardSkip",
    		"display"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<NavigationButtons> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("breakTruth" in $$props) $$invalidate(0, breakTruth = $$props.breakTruth);
    		if ("nextInstruction" in $$props) $$invalidate(1, nextInstruction = $$props.nextInstruction);
    		if ("previousInstruction" in $$props) $$invalidate(2, previousInstruction = $$props.previousInstruction);
    		if ("forwardKey" in $$props) $$invalidate(5, forwardKey = $$props.forwardKey);
    		if ("backKey" in $$props) $$invalidate(6, backKey = $$props.backKey);
    		if ("backSkip" in $$props) $$invalidate(7, backSkip = $$props.backSkip);
    		if ("forwardSkip" in $$props) $$invalidate(8, forwardSkip = $$props.forwardSkip);
    		if ("display" in $$props) $$invalidate(3, display = $$props.display);
    	};

    	$$self.$capture_state = () => ({
    		breakTruth,
    		nextInstruction,
    		previousInstruction,
    		forwardKey,
    		backKey,
    		backSkip,
    		forwardSkip,
    		display,
    		handleKeydown
    	});

    	$$self.$inject_state = $$props => {
    		if ("breakTruth" in $$props) $$invalidate(0, breakTruth = $$props.breakTruth);
    		if ("nextInstruction" in $$props) $$invalidate(1, nextInstruction = $$props.nextInstruction);
    		if ("previousInstruction" in $$props) $$invalidate(2, previousInstruction = $$props.previousInstruction);
    		if ("forwardKey" in $$props) $$invalidate(5, forwardKey = $$props.forwardKey);
    		if ("backKey" in $$props) $$invalidate(6, backKey = $$props.backKey);
    		if ("backSkip" in $$props) $$invalidate(7, backSkip = $$props.backSkip);
    		if ("forwardSkip" in $$props) $$invalidate(8, forwardSkip = $$props.forwardSkip);
    		if ("display" in $$props) $$invalidate(3, display = $$props.display);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		breakTruth,
    		nextInstruction,
    		previousInstruction,
    		display,
    		handleKeydown,
    		forwardKey,
    		backKey,
    		backSkip,
    		forwardSkip
    	];
    }

    class NavigationButtons extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			breakTruth: 0,
    			nextInstruction: 1,
    			previousInstruction: 2,
    			forwardKey: 5,
    			backKey: 6,
    			backSkip: 7,
    			forwardSkip: 8,
    			display: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NavigationButtons",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get breakTruth() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set breakTruth(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nextInstruction() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nextInstruction(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get previousInstruction() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set previousInstruction(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get forwardKey() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set forwardKey(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backKey() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backKey(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backSkip() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backSkip(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get forwardSkip() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set forwardSkip(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get display() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set display(value) {
    		throw new Error("<NavigationButtons>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/SingleChoice.svelte generated by Svelte v3.34.0 */
    const file$5 = "src/Instructions/SingleChoice.svelte";

    // (22:20) {:else}
    function create_else_block$2(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: 0, clearBoard: true },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(22:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (20:20) {#if !clearBoard}
    function create_if_block$5(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploitMu*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty & /*exploitMu*/ 2) redgreen_changes.numberGreen = /*exploitMu*/ ctx[1];
    			redgreen.$set(redgreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(20:20) {#if !clearBoard}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let h10;
    	let t0;
    	let t1;
    	let div3;
    	let h11;
    	let t3;
    	let div0;
    	let t4;
    	let div2;
    	let div1;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$5, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*clearBoard*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			t0 = text(/*passedText*/ ctx[0]);
    			t1 = space();
    			div3 = element("div");
    			h11 = element("h1");
    			h11.textContent = "Current Teaching Move";
    			t3 = space();
    			div0 = element("div");
    			t4 = space();
    			div2 = element("div");
    			div1 = element("div");
    			if_block.c();
    			set_style(h10, "width", "100%");
    			set_style(h10, "text-align", "center");
    			set_style(h10, "color", "black");
    			add_location(h10, file$5, 13, 0, 296);
    			set_style(h11, "top", "-20px");
    			set_style(h11, "width", "430px");
    			set_style(h11, "height", "5px");
    			set_style(h11, "position", "absolute");
    			set_style(h11, "text-align", "center");
    			add_location(h11, file$5, 15, 8, 478);
    			set_style(div0, "width", 450 + "px");
    			set_style(div0, "height", 450 + "px");
    			set_style(div0, "border", "solid blue 5px");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[3] ? "0" : "1");
    			set_style(div0, "top", "37px");
    			set_style(div0, "left", "-12px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$5, 16, 8, 601);
    			set_style(div1, "top", "50px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$5, 18, 16, 897);
    			attr_dev(div2, "class", "greyBox svelte-1cvmqdk");
    			attr_dev(div2, "id", "trial");
    			set_style(div2, "width", "430px");
    			set_style(div2, "top", "50px");
    			set_style(div2, "height", "430px");
    			set_style(div2, "border", "solid black 3px");
    			set_style(div2, "margin", "0px");
    			add_location(div2, file$5, 17, 12, 764);
    			set_style(div3, "top", "calc(50vh + -275px)");
    			set_style(div3, "left", "calc(50vw - 215px)");
    			set_style(div3, "position", "absolute");
    			set_style(div3, "height", "450px");
    			add_location(div3, file$5, 14, 4, 374);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			append_dev(h10, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h11);
    			append_dev(div3, t3);
    			append_dev(div3, div0);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*passedText*/ 1) set_data_dev(t0, /*passedText*/ ctx[0]);

    			if (!current || dirty & /*exploitSelect*/ 8) {
    				set_style(div0, "opacity", !/*exploitSelect*/ ctx[3] ? "0" : "1");
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div1, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div3);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("SingleChoice", slots, []);
    	let { passedText = "" } = $$props;
    	let { exploitMu = 10 } = $$props;
    	let { clearBoard = false } = $$props;
    	let { exploitSelect = true } = $$props;
    	const writable_props = ["passedText", "exploitMu", "clearBoard", "exploitSelect"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SingleChoice> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("passedText" in $$props) $$invalidate(0, passedText = $$props.passedText);
    		if ("exploitMu" in $$props) $$invalidate(1, exploitMu = $$props.exploitMu);
    		if ("clearBoard" in $$props) $$invalidate(2, clearBoard = $$props.clearBoard);
    		if ("exploitSelect" in $$props) $$invalidate(3, exploitSelect = $$props.exploitSelect);
    	};

    	$$self.$capture_state = () => ({
    		RedGreen,
    		passedText,
    		exploitMu,
    		clearBoard,
    		exploitSelect
    	});

    	$$self.$inject_state = $$props => {
    		if ("passedText" in $$props) $$invalidate(0, passedText = $$props.passedText);
    		if ("exploitMu" in $$props) $$invalidate(1, exploitMu = $$props.exploitMu);
    		if ("clearBoard" in $$props) $$invalidate(2, clearBoard = $$props.clearBoard);
    		if ("exploitSelect" in $$props) $$invalidate(3, exploitSelect = $$props.exploitSelect);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [passedText, exploitMu, clearBoard, exploitSelect];
    }

    class SingleChoice extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			passedText: 0,
    			exploitMu: 1,
    			clearBoard: 2,
    			exploitSelect: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SingleChoice",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get passedText() {
    		throw new Error("<SingleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set passedText(value) {
    		throw new Error("<SingleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitMu() {
    		throw new Error("<SingleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitMu(value) {
    		throw new Error("<SingleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get clearBoard() {
    		throw new Error("<SingleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clearBoard(value) {
    		throw new Error("<SingleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitSelect() {
    		throw new Error("<SingleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitSelect(value) {
    		throw new Error("<SingleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/DoubleChoice.svelte generated by Svelte v3.34.0 */
    const file$4 = "src/Instructions/DoubleChoice.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[32] = list[i];
    	return child_ctx;
    }

    // (171:4) {#if pointCounter}
    function create_if_block_4$2(ctx) {
    	let h1;
    	let t0;
    	let t1_value = Math.round(/*points*/ ctx[10] / 20 * 100) + "";
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("Current Classroom Understanding: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "top", "0vh");
    			set_style(h1, "left", "calc(50vw + -400px)");
    			set_style(h1, "width", "800px");
    			set_style(h1, "height", "50px");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "border", "solid black 2px");
    			add_location(h1, file$4, 171, 8, 4665);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*points*/ 1024 && t1_value !== (t1_value = Math.round(/*points*/ ctx[10] / 20 * 100) + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$2.name,
    		type: "if",
    		source: "(171:4) {#if pointCounter}",
    		ctx
    	});

    	return block;
    }

    // (188:8) {:else}
    function create_else_block_1$1(ctx) {
    	let h1;
    	let t1;
    	let div1;
    	let div0;
    	let current_block_type_index;
    	let if_block;
    	let div1_intro;
    	let div1_outro;
    	let t2;
    	let div2;
    	let current;
    	const if_block_creators = [create_if_block_3$3, create_else_block_2$1];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*viewExplore*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "New Teaching Move";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			if_block.c();
    			t2 = space();
    			div2 = element("div");
    			set_style(h1, "top", "-50px");
    			set_style(h1, "width", "430px");
    			set_style(h1, "height", "5px");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$4, 188, 8, 5923);
    			set_style(div0, "top", "50px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$4, 190, 12, 6332);
    			attr_dev(div1, "class", "greyBox svelte-a980so");
    			attr_dev(div1, "id", "trial2");
    			set_style(div1, "width", /*blockSize*/ ctx[14]);
    			set_style(div1, "top", "50px");
    			set_style(div1, "height", /*blockSize*/ ctx[14]);
    			set_style(div1, "border", "solid black 3px");
    			set_style(div1, "margin", "0px");
    			set_style(div1, "display", /*invisibleExplore*/ ctx[11] ? "none" : "");
    			add_location(div1, file$4, 189, 8, 6042);
    			set_style(div2, "width", 450 + "px");
    			set_style(div2, "height", 450 + "px");
    			set_style(div2, "border", "solid blue 5px");
    			set_style(div2, "opacity", !/*exploreSelect*/ ctx[3] ? "0" : "1");
    			set_style(div2, "top", "37px");
    			set_style(div2, "left", "-12px");
    			set_style(div2, "position", "absolute");
    			add_location(div2, file$4, 198, 12, 6654);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div2, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div0, null);
    			}

    			if (!current || dirty[0] & /*invisibleExplore*/ 2048) {
    				set_style(div1, "display", /*invisibleExplore*/ ctx[11] ? "none" : "");
    			}

    			if (!current || dirty[0] & /*exploreSelect*/ 8) {
    				set_style(div2, "opacity", !/*exploreSelect*/ ctx[3] ? "0" : "1");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			add_render_callback(() => {
    				if (div1_outro) div1_outro.end(1);

    				if (!div1_intro) div1_intro = create_in_transition(div1, /*migrateLeftExplore*/ ctx[16], {
    					replaceExploit: /*replaceExploit*/ ctx[5]
    				});

    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			if (div1_intro) div1_intro.invalidate();

    			div1_outro = create_out_transition(div1, /*InvisibleOrDown*/ ctx[19], {
    				replaceExploit: /*replaceExploit*/ ctx[5]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div1_outro) div1_outro.end();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(188:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (176:8) {#if i==0}
    function create_if_block_1$4(ctx) {
    	let h1;
    	let t1;
    	let div0;
    	let t2;
    	let div2;
    	let div1;
    	let current_block_type_index;
    	let if_block;
    	let div2_intro;
    	let div2_outro;
    	let current;
    	const if_block_creators = [create_if_block_2$4, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*clearBoard*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Current Teaching Move";
    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			if_block.c();
    			set_style(h1, "top", "-50px");
    			set_style(h1, "width", "430px");
    			set_style(h1, "height", "5px");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$4, 176, 8, 5051);
    			set_style(div0, "width", 450 + "px");
    			set_style(div0, "height", 450 + "px");
    			set_style(div0, "border", "solid blue 5px");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[4] ? "0" : "1");
    			set_style(div0, "top", "37px");
    			set_style(div0, "left", "-12px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$4, 177, 8, 5173);
    			set_style(div1, "top", "50px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$4, 179, 16, 5591);
    			attr_dev(div2, "class", "greyBox svelte-a980so");
    			attr_dev(div2, "id", "trial1");
    			set_style(div2, "width", /*blockSize*/ ctx[14]);
    			set_style(div2, "top", "50px");
    			set_style(div2, "height", /*blockSize*/ ctx[14]);
    			set_style(div2, "border", "solid black 3px");
    			set_style(div2, "margin", "0px");
    			add_location(div2, file$4, 178, 12, 5337);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty[0] & /*exploitSelect*/ 16) {
    				set_style(div0, "opacity", !/*exploitSelect*/ ctx[4] ? "0" : "1");
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div1, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			add_render_callback(() => {
    				if (div2_outro) div2_outro.end(1);

    				if (!div2_intro) div2_intro = create_in_transition(div2, /*migrateLeftExploit*/ ctx[17], {
    					replaceExploit: /*replaceExploit*/ ctx[5]
    				});

    				div2_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			if (div2_intro) div2_intro.invalidate();

    			div2_outro = create_out_transition(div2, /*migrateOut*/ ctx[18], {
    				replaceExploit: /*replaceExploit*/ ctx[5]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div2);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div2_outro) div2_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(176:8) {#if i==0}",
    		ctx
    	});

    	return block;
    }

    // (194:16) {:else}
    function create_else_block_2$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "?";
    			set_style(div, "width", "430px");
    			set_style(div, "text-align", "center");
    			set_style(div, "font-size", "200px");
    			add_location(div, file$4, 194, 20, 6510);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$1.name,
    		type: "else",
    		source: "(194:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (192:16) {#if viewExplore}
    function create_if_block_3$3(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploreMu*/ ctx[8] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploreMu*/ 256) redgreen_changes.numberGreen = /*exploreMu*/ ctx[8];
    			redgreen.$set(redgreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$3.name,
    		type: "if",
    		source: "(192:16) {#if viewExplore}",
    		ctx
    	});

    	return block;
    }

    // (183:20) {:else}
    function create_else_block$1(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: 0, clearBoard: true },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(183:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (181:20) {#if !clearBoard}
    function create_if_block_2$4(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploitMu*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploitMu*/ 4) redgreen_changes.numberGreen = /*exploitMu*/ ctx[2];
    			redgreen.$set(redgreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$4.name,
    		type: "if",
    		source: "(181:20) {#if !clearBoard}",
    		ctx
    	});

    	return block;
    }

    // (201:4) {#if keyView}
    function create_if_block$4(ctx) {
    	let div;
    	let h2;
    	let t_value = (/*i*/ ctx[32] === 0 ? "Left Arrow" : "Right Arrow") + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			t = text(t_value);
    			set_style(h2, "width", "200px");
    			set_style(h2, "border", "solid black 3px");
    			set_style(h2, "text-align", "center");
    			add_location(h2, file$4, 202, 12, 6962);
    			set_style(div, "top", "500px");
    			set_style(div, "left", "0px");
    			set_style(div, "width", "430px");
    			set_style(div, "display", "flex");
    			set_style(div, "justify-content", "center");
    			set_style(div, "position", "absolute");
    			add_location(div, file$4, 201, 8, 6842);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(h2, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(201:4) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (174:4) {#each range as i}
    function create_each_block$1(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block0;
    	let t0;
    	let t1;
    	let current;
    	const if_block_creators = [create_if_block_1$4, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[32] == 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[12] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			set_style(div, "position", "absolute");
    			set_style(div, "top", "25vh");
    			set_style(div, "left", "calc(" + (/*i*/ ctx[32] + 1) * Math.round(/*viewPortScale*/ ctx[13] / (/*viewNumber*/ ctx[7] + 1)) + "vw - 215px)");
    			add_location(div, file$4, 174, 8, 4908);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			append_dev(div, t0);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t1);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if_block0.p(ctx, dirty);

    			if (/*keyView*/ ctx[12]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$4(ctx);
    					if_block1.c();
    					if_block1.m(div, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(174:4) {#each range as i}",
    		ctx
    	});

    	return block;
    }

    // (170:0) {#key counter}
    function create_key_block$1(ctx) {
    	let t;
    	let each_1_anchor;
    	let current;
    	let if_block = /*pointCounter*/ ctx[9] && create_if_block_4$2(ctx);
    	let each_value = /*range*/ ctx[15];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*pointCounter*/ ctx[9]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_4$2(ctx);
    					if_block.c();
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*range, viewPortScale, viewNumber, keyView, blockSize, replaceExploit, exploitMu, clearBoard, exploitSelect, exploreSelect, invisibleExplore, exploreMu, viewExplore*/ 63998) {
    				each_value = /*range*/ ctx[15];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block$1.name,
    		type: "key",
    		source: "(170:0) {#key counter}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let previous_key = /*counter*/ ctx[0];
    	let key_block_anchor;
    	let current;
    	let key_block = create_key_block$1(ctx);

    	const block = {
    		c: function create() {
    			key_block.c();
    			key_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*counter*/ 1 && safe_not_equal(previous_key, previous_key = /*counter*/ ctx[0])) {
    				group_outros();
    				transition_out(key_block, 1, 1, noop);
    				check_outros();
    				key_block = create_key_block$1(ctx);
    				key_block.c();
    				transition_in(key_block);
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(key_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(key_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function timer$2(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("DoubleChoice", slots, []);
    	let { breakNav } = $$props;
    	let { counter = 0 } = $$props;
    	const viewNumber = 2;
    	let viewPortScale = 100;
    	let blockSize = "430px";
    	let range = [...Array(viewNumber).keys()];
    	let { delayGoodExplore = false } = $$props;
    	let { delayBadExplore = false } = $$props;
    	let { delayExploit = false } = $$props;
    	let { viewExplore = false } = $$props;
    	let { exploitMu = 12 } = $$props;
    	let { exploreMu = 5 } = $$props;
    	let { exploitMu2 = 14 } = $$props;
    	let { exploreSelect = false } = $$props;
    	let { exploitSelect = false } = $$props;
    	let { replaceExploit = { truth: true } } = $$props;
    	let { clearBoard = false } = $$props;
    	let { bothInvisible = { truth: true } } = $$props;
    	let { keyDisplay = false } = $$props;
    	let { noReplaceExplore = false } = $$props;
    	let { pointCounter = false } = $$props;
    	let { points = 14 } = $$props;
    	let { delayTime = 1000 } = $$props;
    	let invisibleExplore = false;
    	let keyView = keyDisplay;

    	if (delayGoodExplore) {
    		delayedGoodExplore();
    	}

    	if (delayBadExplore) {
    		delayedBadExplore();
    	}

    	if (delayExploit) {
    		delayedExploit();
    	}

    	function migrateLeftExplore(node, { delay = 0, duration = 500 }) {
    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		return {
    			delay,
    			duration,
    			css: (t, u) => `transform: translateX(calc(${100 * u}vw)) `
    		};
    	}

    	function migrateLeftExploit(node, { replaceExploit, delay = 0, duration = 500 }) {
    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		if (replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateX(calc(${viewPortScale / (viewNumber + 1) * u}vw)) `
    			};
    		} else {
    			return {};
    		}
    	}

    	function migrateOut(node, { replaceExploit, delay = 0, duration = 500 }) {
    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		if (replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateX(calc(${-100 * u}vw)) `
    			};
    		} else {
    			return {};
    		}
    	}

    	function InvisibleOrDown(node, { replaceExploit, delay = 0, duration = 500 }) {
    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		if (!replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateY(calc(${100 * u}vh)) `
    			};
    		} else {
    			return {
    				css: () => `visibility: hidden;display: none;`
    			};
    		}
    	}

    	async function delayedGoodExplore() {
    		if (keyDisplay) $$invalidate(12, keyView = false);
    		breakNav(true);
    		await timer$2(delayTime);
    		$$invalidate(20, bothInvisible = { truth: false });
    		$$invalidate(1, viewExplore = true);
    		$$invalidate(3, exploreSelect = true);
    		await timer$2(500);
    		$$invalidate(3, exploreSelect = false);
    		await timer$2(1000);
    		$$invalidate(2, exploitMu = exploreMu);
    		$$invalidate(1, viewExplore = false);
    		$$invalidate(5, replaceExploit.truth = true, replaceExploit);
    		$$invalidate(0, counter += 1);
    		if (noReplaceExplore) $$invalidate(11, invisibleExplore = true);
    		await timer$2(500);
    		breakNav(false);
    		if (keyDisplay) $$invalidate(12, keyView = true);
    		$$invalidate(20, bothInvisible = { truth: true });
    	}

    	async function delayedBadExplore() {
    		if (keyDisplay) $$invalidate(12, keyView = false);
    		breakNav(true);
    		await timer$2(delayTime);
    		$$invalidate(20, bothInvisible = { truth: false });
    		$$invalidate(1, viewExplore = true);
    		$$invalidate(3, exploreSelect = true);
    		await timer$2(500);
    		$$invalidate(3, exploreSelect = false);
    		await timer$2(1000);
    		$$invalidate(1, viewExplore = false);
    		$$invalidate(5, replaceExploit.truth = false, replaceExploit);
    		$$invalidate(0, counter += 1);
    		if (noReplaceExplore) $$invalidate(11, invisibleExplore = true);
    		await timer$2(500);
    		breakNav(false);
    		if (keyDisplay) $$invalidate(12, keyView = true);
    		$$invalidate(20, bothInvisible = { truth: true });
    	}

    	async function delayedExploit() {
    		if (keyDisplay) $$invalidate(12, keyView = false);
    		breakNav(true);
    		await timer$2(delayTime);
    		$$invalidate(4, exploitSelect = true);
    		$$invalidate(20, bothInvisible = { truth: false });
    		await timer$2(500);
    		$$invalidate(6, clearBoard = true);
    		$$invalidate(4, exploitSelect = false);
    		await timer$2(1000);
    		$$invalidate(6, clearBoard = false);
    		$$invalidate(2, exploitMu = exploitMu2);
    		$$invalidate(0, counter += 1);
    		breakNav(false);
    		if (keyDisplay) $$invalidate(12, keyView = true);
    		$$invalidate(20, bothInvisible = { truth: true });
    	}

    	const writable_props = [
    		"breakNav",
    		"counter",
    		"delayGoodExplore",
    		"delayBadExplore",
    		"delayExploit",
    		"viewExplore",
    		"exploitMu",
    		"exploreMu",
    		"exploitMu2",
    		"exploreSelect",
    		"exploitSelect",
    		"replaceExploit",
    		"clearBoard",
    		"bothInvisible",
    		"keyDisplay",
    		"noReplaceExplore",
    		"pointCounter",
    		"points",
    		"delayTime"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<DoubleChoice> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("breakNav" in $$props) $$invalidate(21, breakNav = $$props.breakNav);
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("delayGoodExplore" in $$props) $$invalidate(22, delayGoodExplore = $$props.delayGoodExplore);
    		if ("delayBadExplore" in $$props) $$invalidate(23, delayBadExplore = $$props.delayBadExplore);
    		if ("delayExploit" in $$props) $$invalidate(24, delayExploit = $$props.delayExploit);
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(8, exploreMu = $$props.exploreMu);
    		if ("exploitMu2" in $$props) $$invalidate(25, exploitMu2 = $$props.exploitMu2);
    		if ("exploreSelect" in $$props) $$invalidate(3, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(4, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(5, replaceExploit = $$props.replaceExploit);
    		if ("clearBoard" in $$props) $$invalidate(6, clearBoard = $$props.clearBoard);
    		if ("bothInvisible" in $$props) $$invalidate(20, bothInvisible = $$props.bothInvisible);
    		if ("keyDisplay" in $$props) $$invalidate(26, keyDisplay = $$props.keyDisplay);
    		if ("noReplaceExplore" in $$props) $$invalidate(27, noReplaceExplore = $$props.noReplaceExplore);
    		if ("pointCounter" in $$props) $$invalidate(9, pointCounter = $$props.pointCounter);
    		if ("points" in $$props) $$invalidate(10, points = $$props.points);
    		if ("delayTime" in $$props) $$invalidate(28, delayTime = $$props.delayTime);
    	};

    	$$self.$capture_state = () => ({
    		RedGreen,
    		breakNav,
    		counter,
    		viewNumber,
    		viewPortScale,
    		blockSize,
    		range,
    		delayGoodExplore,
    		delayBadExplore,
    		delayExploit,
    		viewExplore,
    		exploitMu,
    		exploreMu,
    		exploitMu2,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		clearBoard,
    		bothInvisible,
    		keyDisplay,
    		noReplaceExplore,
    		pointCounter,
    		points,
    		delayTime,
    		invisibleExplore,
    		keyView,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		timer: timer$2,
    		delayedGoodExplore,
    		delayedBadExplore,
    		delayedExploit
    	});

    	$$self.$inject_state = $$props => {
    		if ("breakNav" in $$props) $$invalidate(21, breakNav = $$props.breakNav);
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("viewPortScale" in $$props) $$invalidate(13, viewPortScale = $$props.viewPortScale);
    		if ("blockSize" in $$props) $$invalidate(14, blockSize = $$props.blockSize);
    		if ("range" in $$props) $$invalidate(15, range = $$props.range);
    		if ("delayGoodExplore" in $$props) $$invalidate(22, delayGoodExplore = $$props.delayGoodExplore);
    		if ("delayBadExplore" in $$props) $$invalidate(23, delayBadExplore = $$props.delayBadExplore);
    		if ("delayExploit" in $$props) $$invalidate(24, delayExploit = $$props.delayExploit);
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(8, exploreMu = $$props.exploreMu);
    		if ("exploitMu2" in $$props) $$invalidate(25, exploitMu2 = $$props.exploitMu2);
    		if ("exploreSelect" in $$props) $$invalidate(3, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(4, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(5, replaceExploit = $$props.replaceExploit);
    		if ("clearBoard" in $$props) $$invalidate(6, clearBoard = $$props.clearBoard);
    		if ("bothInvisible" in $$props) $$invalidate(20, bothInvisible = $$props.bothInvisible);
    		if ("keyDisplay" in $$props) $$invalidate(26, keyDisplay = $$props.keyDisplay);
    		if ("noReplaceExplore" in $$props) $$invalidate(27, noReplaceExplore = $$props.noReplaceExplore);
    		if ("pointCounter" in $$props) $$invalidate(9, pointCounter = $$props.pointCounter);
    		if ("points" in $$props) $$invalidate(10, points = $$props.points);
    		if ("delayTime" in $$props) $$invalidate(28, delayTime = $$props.delayTime);
    		if ("invisibleExplore" in $$props) $$invalidate(11, invisibleExplore = $$props.invisibleExplore);
    		if ("keyView" in $$props) $$invalidate(12, keyView = $$props.keyView);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		counter,
    		viewExplore,
    		exploitMu,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		clearBoard,
    		viewNumber,
    		exploreMu,
    		pointCounter,
    		points,
    		invisibleExplore,
    		keyView,
    		viewPortScale,
    		blockSize,
    		range,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		bothInvisible,
    		breakNav,
    		delayGoodExplore,
    		delayBadExplore,
    		delayExploit,
    		exploitMu2,
    		keyDisplay,
    		noReplaceExplore,
    		delayTime
    	];
    }

    class DoubleChoice extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$6,
    			create_fragment$6,
    			safe_not_equal,
    			{
    				breakNav: 21,
    				counter: 0,
    				viewNumber: 7,
    				delayGoodExplore: 22,
    				delayBadExplore: 23,
    				delayExploit: 24,
    				viewExplore: 1,
    				exploitMu: 2,
    				exploreMu: 8,
    				exploitMu2: 25,
    				exploreSelect: 3,
    				exploitSelect: 4,
    				replaceExploit: 5,
    				clearBoard: 6,
    				bothInvisible: 20,
    				keyDisplay: 26,
    				noReplaceExplore: 27,
    				pointCounter: 9,
    				points: 10,
    				delayTime: 28
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DoubleChoice",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*breakNav*/ ctx[21] === undefined && !("breakNav" in props)) {
    			console.warn("<DoubleChoice> was created without expected prop 'breakNav'");
    		}
    	}

    	get breakNav() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set breakNav(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get counter() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set counter(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewNumber() {
    		return this.$$.ctx[7];
    	}

    	set viewNumber(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get delayGoodExplore() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set delayGoodExplore(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get delayBadExplore() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set delayBadExplore(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get delayExploit() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set delayExploit(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewExplore() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set viewExplore(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitMu() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitMu(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploreMu() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploreMu(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitMu2() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitMu2(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploreSelect() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploreSelect(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitSelect() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitSelect(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replaceExploit() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replaceExploit(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get clearBoard() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clearBoard(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bothInvisible() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bothInvisible(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get keyDisplay() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set keyDisplay(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get noReplaceExplore() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set noReplaceExplore(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pointCounter() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pointCounter(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get points() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set points(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get delayTime() {
    		throw new Error("<DoubleChoice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set delayTime(value) {
    		throw new Error("<DoubleChoice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/FullScreen.svelte generated by Svelte v3.34.0 */

    const file$3 = "src/Instructions/FullScreen.svelte";

    function create_fragment$5(ctx) {
    	let h1;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "This Experiment is Best Viewed In Fullscreen";
    			t1 = space();
    			button = element("button");
    			button.textContent = "Go Fullscreen";
    			set_style(h1, "width", "100%");
    			set_style(h1, "height", "200px");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$3, 33, 0, 902);
    			attr_dev(button, "class", "pretty_button svelte-1rd53y3");
    			add_location(button, file$3, 34, 0, 1009);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*requestFullScreen*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function timer$1(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("FullScreen", slots, []);
    	let { nextInstruction } = $$props;

    	async function requestFullScreen() {
    		var elem = document.documentElement;
    		var requestMethod = elem.requestFullScreen || elem.webkitRequestFullScreen || elem.mozRequestFullScreen || elem.msRequestFullScreen;

    		if (requestMethod) {
    			requestMethod.call(elem);
    		}

    		await timer$1(100);
    		nextInstruction(1);
    	}

    	const writable_props = ["nextInstruction"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<FullScreen> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("nextInstruction" in $$props) $$invalidate(1, nextInstruction = $$props.nextInstruction);
    	};

    	$$self.$capture_state = () => ({
    		nextInstruction,
    		timer: timer$1,
    		requestFullScreen
    	});

    	$$self.$inject_state = $$props => {
    		if ("nextInstruction" in $$props) $$invalidate(1, nextInstruction = $$props.nextInstruction);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [requestFullScreen, nextInstruction];
    }

    class FullScreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { nextInstruction: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FullScreen",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*nextInstruction*/ ctx[1] === undefined && !("nextInstruction" in props)) {
    			console.warn("<FullScreen> was created without expected prop 'nextInstruction'");
    		}
    	}

    	get nextInstruction() {
    		throw new Error("<FullScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nextInstruction(value) {
    		throw new Error("<FullScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/PracticeGame.svelte generated by Svelte v3.34.0 */

    const { console: console_1$3 } = globals;
    const file$2 = "src/Instructions/PracticeGame.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	return child_ctx;
    }

    // (240:8) {#if trial<=numTrials}
    function create_if_block$3(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let t;
    	let current;
    	const if_block_creators = [create_if_block_1$3, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[30] == 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t = space();
    			set_style(div, "position", "absolute");
    			set_style(div, "top", "25vh");
    			set_style(div, "left", "calc(" + (/*i*/ ctx[30] + 1) * Math.round(/*viewPortScale*/ ctx[13] / (/*viewNumber*/ ctx[10] + 1)) + "vw - 215px)");
    			add_location(div, file$2, 240, 16, 8289);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			append_dev(div, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(240:8) {#if trial<=numTrials}",
    		ctx
    	});

    	return block;
    }

    // (259:16) {:else}
    function create_else_block_1(ctx) {
    	let h1;
    	let t1;
    	let div1;
    	let div0;
    	let current_block_type_index;
    	let if_block0;
    	let div1_id_value;
    	let div1_intro;
    	let div1_outro;
    	let t2;
    	let div2;
    	let t3;
    	let if_block1_anchor;
    	let current;
    	const if_block_creators = [create_if_block_5$1, create_else_block_2];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*viewExplore*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[7] && create_if_block_4$1(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "New Teaching Move";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			if_block0.c();
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			set_style(h1, "top", "-100px");
    			set_style(h1, "width", "430px");
    			set_style(h1, "height", "5px");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$2, 259, 16, 9745);
    			set_style(div0, "top", "50px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$2, 261, 20, 10143);
    			attr_dev(div1, "class", "greyBox svelte-a980so");
    			attr_dev(div1, "id", div1_id_value = `box2: ${/*counter*/ ctx[0]}`);
    			set_style(div1, "width", /*blockSize*/ ctx[14]);
    			set_style(div1, "top", "50px");
    			set_style(div1, "height", /*blockSize*/ ctx[14]);
    			set_style(div1, "border", "solid black 3px");
    			set_style(div1, "margin", "0px");
    			add_location(div1, file$2, 260, 16, 9873);
    			set_style(div2, "width", 450 + "px");
    			set_style(div2, "height", 450 + "px");
    			set_style(div2, "border", "solid blue 5px");
    			set_style(div2, "opacity", !/*exploreSelect*/ ctx[4] ? "0" : "1");
    			set_style(div2, "top", "37px");
    			set_style(div2, "left", "-12px");
    			set_style(div2, "position", "absolute");
    			add_location(div2, file$2, 269, 17, 10523);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div2, anchor);
    			insert_dev(target, t3, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block0 = if_blocks[current_block_type_index];

    				if (!if_block0) {
    					if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block0.c();
    				} else {
    					if_block0.p(ctx, dirty);
    				}

    				transition_in(if_block0, 1);
    				if_block0.m(div0, null);
    			}

    			if (!current || dirty[0] & /*counter*/ 1 && div1_id_value !== (div1_id_value = `box2: ${/*counter*/ ctx[0]}`)) {
    				attr_dev(div1, "id", div1_id_value);
    			}

    			if (!current || dirty[0] & /*exploreSelect*/ 16) {
    				set_style(div2, "opacity", !/*exploreSelect*/ ctx[4] ? "0" : "1");
    			}

    			if (/*keyView*/ ctx[7]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_4$1(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);

    			add_render_callback(() => {
    				if (div1_outro) div1_outro.end(1);

    				if (!div1_intro) div1_intro = create_in_transition(div1, /*migrateLeftExplore*/ ctx[16], {
    					replaceExploit: /*replaceExploit*/ ctx[6]
    				});

    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div1_intro) div1_intro.invalidate();

    			div1_outro = create_out_transition(div1, /*InvisibleOrDown*/ ctx[19], {
    				replaceExploit: /*replaceExploit*/ ctx[6]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div1_outro) div1_outro.end();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t3);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(259:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (242:16) {#if i==0}
    function create_if_block_1$3(ctx) {
    	let h1;
    	let t1;
    	let div0;
    	let t2;
    	let div2;
    	let div1;
    	let current_block_type_index;
    	let if_block0;
    	let div2_id_value;
    	let div2_intro;
    	let div2_outro;
    	let t3;
    	let if_block1_anchor;
    	let current;
    	const if_block_creators = [create_if_block_3$2, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*clearBoard*/ ctx[8]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[7] && create_if_block_2$3(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Current Teaching Move";
    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			set_style(h1, "top", "-100px");
    			set_style(h1, "width", "430px");
    			set_style(h1, "height", "5px");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$2, 242, 16, 8448);
    			set_style(div0, "width", 450 + "px");
    			set_style(div0, "height", 450 + "px");
    			set_style(div0, "border", "solid blue 5px");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[5] ? "0" : "1");
    			set_style(div0, "top", "37px");
    			set_style(div0, "left", "-12px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$2, 243, 16, 8579);
    			set_style(div1, "top", "50px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$2, 245, 24, 9023);
    			attr_dev(div2, "class", "greyBox svelte-a980so");
    			attr_dev(div2, "id", div2_id_value = `box1: ${/*counter*/ ctx[0]}`);
    			set_style(div2, "width", /*blockSize*/ ctx[14]);
    			set_style(div2, "top", "50px");
    			set_style(div2, "height", /*blockSize*/ ctx[14]);
    			set_style(div2, "border", "solid black 3px");
    			set_style(div2, "margin", "0px");
    			add_location(div2, file$2, 244, 20, 8751);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			insert_dev(target, t3, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty[0] & /*exploitSelect*/ 32) {
    				set_style(div0, "opacity", !/*exploitSelect*/ ctx[5] ? "0" : "1");
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block0 = if_blocks[current_block_type_index];

    				if (!if_block0) {
    					if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block0.c();
    				} else {
    					if_block0.p(ctx, dirty);
    				}

    				transition_in(if_block0, 1);
    				if_block0.m(div1, null);
    			}

    			if (!current || dirty[0] & /*counter*/ 1 && div2_id_value !== (div2_id_value = `box1: ${/*counter*/ ctx[0]}`)) {
    				attr_dev(div2, "id", div2_id_value);
    			}

    			if (/*keyView*/ ctx[7]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_2$3(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);

    			add_render_callback(() => {
    				if (div2_outro) div2_outro.end(1);

    				if (!div2_intro) div2_intro = create_in_transition(div2, /*migrateLeftExploit*/ ctx[17], {
    					replaceExploit: /*replaceExploit*/ ctx[6]
    				});

    				div2_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div2_intro) div2_intro.invalidate();

    			div2_outro = create_out_transition(div2, /*migrateOut*/ ctx[18], {
    				replaceExploit: /*replaceExploit*/ ctx[6]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div2);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div2_outro) div2_outro.end();
    			if (detaching) detach_dev(t3);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(242:16) {#if i==0}",
    		ctx
    	});

    	return block;
    }

    // (265:24) {:else}
    function create_else_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "?";
    			set_style(div, "width", "430px");
    			set_style(div, "text-align", "center");
    			set_style(div, "font-size", "200px");
    			add_location(div, file$2, 265, 28, 10353);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(265:24) {:else}",
    		ctx
    	});

    	return block;
    }

    // (263:24) {#if viewExplore}
    function create_if_block_5$1(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploreMu*/ ctx[3] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploreMu*/ 8) redgreen_changes.numberGreen = /*exploreMu*/ ctx[3];
    			redgreen.$set(redgreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5$1.name,
    		type: "if",
    		source: "(263:24) {#if viewExplore}",
    		ctx
    	});

    	return block;
    }

    // (271:12) {#if keyView}
    function create_if_block_4$1(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Right Arrow";
    			set_style(h2, "width", "200px");
    			set_style(h2, "border", "solid black 3px");
    			set_style(h2, "text-align", "center");
    			add_location(h2, file$2, 272, 20, 10846);
    			set_style(div, "top", "500px");
    			set_style(div, "left", "0px");
    			set_style(div, "width", "430px");
    			set_style(div, "display", "flex");
    			set_style(div, "justify-content", "center");
    			set_style(div, "position", "absolute");
    			add_location(div, file$2, 271, 17, 10718);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(271:12) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (249:28) {:else}
    function create_else_block(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: 0, clearBoard: true },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(249:28) {:else}",
    		ctx
    	});

    	return block;
    }

    // (247:28) {#if !clearBoard}
    function create_if_block_3$2(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploitMu*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploitMu*/ 4) redgreen_changes.numberGreen = /*exploitMu*/ ctx[2];
    			redgreen.$set(redgreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redgreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redgreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redgreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(247:28) {#if !clearBoard}",
    		ctx
    	});

    	return block;
    }

    // (254:16) {#if keyView}
    function create_if_block_2$3(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Left Arrow";
    			set_style(h2, "width", "200px");
    			set_style(h2, "border", "solid black 3px");
    			set_style(h2, "text-align", "center");
    			add_location(h2, file$2, 255, 24, 9569);
    			set_style(div, "top", "500px");
    			set_style(div, "left", "0px");
    			set_style(div, "width", "430px");
    			set_style(div, "display", "flex");
    			set_style(div, "justify-content", "center");
    			set_style(div, "position", "absolute");
    			add_location(div, file$2, 254, 20, 9437);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(254:16) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (239:4) {#each range as i}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*trial*/ ctx[11] <= /*numTrials*/ ctx[12] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*trial*/ ctx[11] <= /*numTrials*/ ctx[12]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*trial*/ 2048) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(239:4) {#each range as i}",
    		ctx
    	});

    	return block;
    }

    // (236:0) {#key counter}
    function create_key_block(ctx) {
    	let h10;
    	let t0;
    	let t1_value = Math.round(/*currentUnderstanding*/ ctx[9] / 20 * 100) + "";
    	let t1;
    	let t2;
    	let t3;
    	let h11;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let each_1_anchor;
    	let current;
    	let each_value = /*range*/ ctx[15];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			t0 = text("Current Classroom Understanding: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    			t3 = space();
    			h11 = element("h1");
    			t4 = text(/*trial*/ ctx[11]);
    			t5 = text(" of ");
    			t6 = text(/*numTrials*/ ctx[12]);
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			set_style(h10, "position", "absolute");
    			set_style(h10, "top", "0vh");
    			set_style(h10, "left", "calc(50vw + -400px)");
    			set_style(h10, "width", "800px");
    			set_style(h10, "height", "50px");
    			set_style(h10, "text-align", "center");
    			set_style(h10, "border", "solid black 2px");
    			add_location(h10, file$2, 236, 0, 7839);
    			set_style(h11, "position", "absolute");
    			set_style(h11, "top", "0vh");
    			set_style(h11, "left", "calc(100vw + -110px)");
    			set_style(h11, "width", "100px");
    			set_style(h11, "height", "50px");
    			set_style(h11, "text-align", "center");
    			set_style(h11, "border", "solid black 2px");
    			add_location(h11, file$2, 237, 0, 8055);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			append_dev(h10, t0);
    			append_dev(h10, t1);
    			append_dev(h10, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, h11, anchor);
    			append_dev(h11, t4);
    			append_dev(h11, t5);
    			append_dev(h11, t6);
    			insert_dev(target, t7, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty[0] & /*currentUnderstanding*/ 512) && t1_value !== (t1_value = Math.round(/*currentUnderstanding*/ ctx[9] / 20 * 100) + "")) set_data_dev(t1, t1_value);
    			if (!current || dirty[0] & /*trial*/ 2048) set_data_dev(t4, /*trial*/ ctx[11]);

    			if (dirty[0] & /*range, viewPortScale, viewNumber, keyView, counter, blockSize, replaceExploit, exploitMu, clearBoard, exploitSelect, exploreSelect, exploreMu, viewExplore, trial, numTrials*/ 65023) {
    				each_value = /*range*/ ctx[15];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t7);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block.name,
    		type: "key",
    		source: "(236:0) {#key counter}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let previous_key = /*counter*/ ctx[0];
    	let key_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let key_block = create_key_block(ctx);

    	const block = {
    		c: function create() {
    			key_block.c();
    			key_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", /*handleKeydown*/ ctx[20], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*counter*/ 1 && safe_not_equal(previous_key, previous_key = /*counter*/ ctx[0])) {
    				group_outros();
    				transition_out(key_block, 1, 1, noop);
    				check_outros();
    				key_block = create_key_block(ctx);
    				key_block.c();
    				transition_in(key_block);
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(key_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(key_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function timer(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function box_mueller() {
    	// all credit to stack exhange
    	var u = 0, v = 0;

    	while (u === 0) u = Math.random();
    	while (v === 0) v = Math.random();
    	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function sample_normal(mu, sd) {
    	return sd * box_mueller() + mu;
    }

    function random_int() {
    	return Math.floor(20 * Math.random());
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("PracticeGame", slots, []);
    	let { counter = 0 } = $$props;
    	const viewNumber = 2;
    	let trialSd = 3;
    	let numTrials = 5;
    	let trialData = [];
    	let viewPortScale = 100;
    	let blockSize = "430px";
    	let range = [...Array(viewNumber).keys()];
    	let trialStartTime = Date.now();
    	let trial = 1;
    	let gameString = "trial,previousExploit,keyPressTime,trialStartTime,choice,newExploit,exploreSeen,exploitBoardClear,newExploitBoard,newExploreVisible,newExploreDeselected,newExploreMove,exploreFinishedMoving\n";
    	let { nextInstruction } = $$props;
    	let { getData } = $$props;
    	let { viewExplore = false } = $$props;
    	let { exploitMu = random_int() } = $$props;
    	let { exploreMu = random_int() } = $$props;
    	let { exploreSelect = false } = $$props;
    	let { exploitSelect = false } = $$props;
    	let { replaceExploit = { truth: false } } = $$props;
    	let { keyView = true } = $$props;
    	let { clearBoard = false } = $$props;
    	let { currentUnderstanding = exploitMu } = $$props;

    	//$: oldExploit =replaceExploit
    	let bothInvisible = { truth: true };

    	function migrateLeftExplore(node, { delay = 0, duration = 500 }) {
    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		console.log(`migrateLeftExplore:${true}`);

    		return {
    			delay,
    			duration,
    			css: (t, u) => `transform: translateX(calc(${100 * u}vw)) `
    		};
    	}

    	function migrateLeftExploit(node, { replaceExploit, delay = 0, duration = 500 }) {
    		console.log(`migrateLeftExploit:${replaceExploit}`);

    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		if (replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateX(calc(${viewPortScale / (viewNumber + 1) * u}vw)) `
    			};
    		} else {
    			return {};
    		}
    	}

    	function migrateOut(node, { replaceExploit, delay = 0, duration = 500 }) {
    		console.log(`migrateOut:${replaceExploit}`);

    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		if (replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateX(calc(${-100 * u}vw)) `
    			};
    		} else {
    			return {};
    		}
    	}

    	function InvisibleOrDown(node, { replaceExploit, delay = 0, duration = 500 }) {
    		console.log(`invisibleOrDown:${replaceExploit}`);

    		if (bothInvisible.truth) {
    			return { delay: 0, duration: 0 };
    		}

    		if (!replaceExploit.truth) {
    			return {
    				delay,
    				duration,
    				css: (t, u) => `transform: translateY(calc(${100 * u}vh)) `
    			};
    		} else {
    			return {
    				css: () => `visibility: hidden;display: none;`
    			};
    		}
    	}

    	async function handleKeydown(event) {
    		console.log(event.key);

    		if (keyView == false) {
    			return;
    		}

    		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    			let singleTrialData = {
    				trial: `instruction ${trial}`,
    				previousExploit: exploitMu,
    				keyPressTime: Date.now(),
    				trialStartTime
    			};

    			bothInvisible.truth = false;

    			if (event.key == "ArrowLeft") {
    				$$invalidate(7, keyView = false);
    				let newDist = sample_normal_to_twenty();
    				singleTrialData["newExploit"] = newDist;
    				singleTrialData["choice"] = "exploit";
    				$$invalidate(5, exploitSelect = true);
    				await timer(500);
    				$$invalidate(5, exploitSelect = false);
    				$$invalidate(8, clearBoard = true);
    				singleTrialData["exploitBoardClear"] = Date.now();
    				await timer(1000);
    				$$invalidate(2, exploitMu = newDist);
    				$$invalidate(8, clearBoard = false);
    				$$invalidate(7, keyView = true);
    				singleTrialData["newExploitBoard"] = Date.now();
    				trialStartTime = Date.now();
    				$$invalidate(9, currentUnderstanding = newDist);
    				$$invalidate(11, trial += 1);
    				console.log("done");
    			}

    			if (event.key == "ArrowRight") {
    				$$invalidate(1, viewExplore = true);
    				let newDist = random_int();
    				singleTrialData["choice"] = "explore";

    				if (newDist > exploitMu) {
    					singleTrialData["newExploit"] = newDist;
    					console.log("greater than");
    					$$invalidate(7, keyView = false);
    					$$invalidate(3, exploreMu = newDist);
    					$$invalidate(4, exploreSelect = true);
    					singleTrialData["newExploreVisible"] = Date.now();
    					await timer(500);
    					$$invalidate(4, exploreSelect = false);
    					singleTrialData["newExploreDeslected"] = Date.now();
    					await timer(500);
    					$$invalidate(2, exploitMu = newDist);
    					$$invalidate(1, viewExplore = false);
    					$$invalidate(6, replaceExploit.truth = true, replaceExploit);
    					$$invalidate(0, counter += 1);
    					singleTrialData["newExploreMove"] = Date.now();
    					await timer(500);
    					$$invalidate(7, keyView = true);
    					singleTrialData["exploreFinishedMoving"] = Date.now();
    					trialStartTime = Date.now();
    					$$invalidate(9, currentUnderstanding = newDist);
    					$$invalidate(11, trial += 1);
    				} else {
    					console.log("less than");
    					$$invalidate(7, keyView = false);
    					singleTrialData["newExploit"] = null;
    					$$invalidate(3, exploreMu = newDist);
    					$$invalidate(4, exploreSelect = true);
    					singleTrialData["newExploreVisible"] = Date.now();
    					await timer(500);
    					$$invalidate(4, exploreSelect = false);
    					singleTrialData["newExploreDeselected"] = Date.now();
    					await timer(500);
    					singleTrialData["newExploreMove"] = Date.now();
    					$$invalidate(1, viewExplore = false);
    					$$invalidate(6, replaceExploit.truth = false, replaceExploit);
    					$$invalidate(0, counter += 1);
    					await timer(500);
    					$$invalidate(7, keyView = true);
    					singleTrialData["exploreFinishedMoving"] = Date.now();
    					trialStartTime = Date.now();
    					$$invalidate(9, currentUnderstanding = newDist);
    					$$invalidate(11, trial += 1);
    				}
    			}

    			bothInvisible.truth = true;
    			export_data(singleTrialData);

    			if (trial === numTrials + 1) {
    				console.log("fire1");
    				getData(gameString);
    				await timer(500);
    				nextInstruction(1);
    			}
    		}
    	}

    	function sample_normal_to_twenty() {
    		let newNorm = Math.floor(sample_normal(exploitMu, trialSd));
    		newNorm = Math.min(newNorm, 20);
    		newNorm = Math.max(newNorm, 0);
    		return newNorm;
    	}

    	function export_data(data) {
    		let iterate_keys = [
    			"trial",
    			"previousExploit",
    			"keyPressTime",
    			"trialStartTime",
    			"choice",
    			"newExploit",
    			"exploreSeen",
    			"exploitBoardClear",
    			"newExploitBoard",
    			"newExploreVisible",
    			"newExploreDeselected",
    			"newExploreMove",
    			"exploreFinishedMoving"
    		];

    		let trialString = "";

    		for (const key of iterate_keys) {
    			trialString += `${data[key]},`;
    		}

    		gameString += trialString.substring(0, trialString.length - 1) + "\n";
    	}

    	const writable_props = [
    		"counter",
    		"nextInstruction",
    		"getData",
    		"viewExplore",
    		"exploitMu",
    		"exploreMu",
    		"exploreSelect",
    		"exploitSelect",
    		"replaceExploit",
    		"keyView",
    		"clearBoard",
    		"currentUnderstanding"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$3.warn(`<PracticeGame> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("nextInstruction" in $$props) $$invalidate(21, nextInstruction = $$props.nextInstruction);
    		if ("getData" in $$props) $$invalidate(22, getData = $$props.getData);
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(3, exploreMu = $$props.exploreMu);
    		if ("exploreSelect" in $$props) $$invalidate(4, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(5, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(6, replaceExploit = $$props.replaceExploit);
    		if ("keyView" in $$props) $$invalidate(7, keyView = $$props.keyView);
    		if ("clearBoard" in $$props) $$invalidate(8, clearBoard = $$props.clearBoard);
    		if ("currentUnderstanding" in $$props) $$invalidate(9, currentUnderstanding = $$props.currentUnderstanding);
    	};

    	$$self.$capture_state = () => ({
    		RedGreen,
    		counter,
    		viewNumber,
    		trialSd,
    		numTrials,
    		trialData,
    		viewPortScale,
    		blockSize,
    		range,
    		trialStartTime,
    		trial,
    		gameString,
    		nextInstruction,
    		getData,
    		viewExplore,
    		exploitMu,
    		exploreMu,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		keyView,
    		clearBoard,
    		currentUnderstanding,
    		bothInvisible,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		timer,
    		handleKeydown,
    		box_mueller,
    		sample_normal,
    		sample_normal_to_twenty,
    		random_int,
    		export_data
    	});

    	$$self.$inject_state = $$props => {
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("trialSd" in $$props) trialSd = $$props.trialSd;
    		if ("numTrials" in $$props) $$invalidate(12, numTrials = $$props.numTrials);
    		if ("trialData" in $$props) trialData = $$props.trialData;
    		if ("viewPortScale" in $$props) $$invalidate(13, viewPortScale = $$props.viewPortScale);
    		if ("blockSize" in $$props) $$invalidate(14, blockSize = $$props.blockSize);
    		if ("range" in $$props) $$invalidate(15, range = $$props.range);
    		if ("trialStartTime" in $$props) trialStartTime = $$props.trialStartTime;
    		if ("trial" in $$props) $$invalidate(11, trial = $$props.trial);
    		if ("gameString" in $$props) gameString = $$props.gameString;
    		if ("nextInstruction" in $$props) $$invalidate(21, nextInstruction = $$props.nextInstruction);
    		if ("getData" in $$props) $$invalidate(22, getData = $$props.getData);
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(3, exploreMu = $$props.exploreMu);
    		if ("exploreSelect" in $$props) $$invalidate(4, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(5, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(6, replaceExploit = $$props.replaceExploit);
    		if ("keyView" in $$props) $$invalidate(7, keyView = $$props.keyView);
    		if ("clearBoard" in $$props) $$invalidate(8, clearBoard = $$props.clearBoard);
    		if ("currentUnderstanding" in $$props) $$invalidate(9, currentUnderstanding = $$props.currentUnderstanding);
    		if ("bothInvisible" in $$props) bothInvisible = $$props.bothInvisible;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		counter,
    		viewExplore,
    		exploitMu,
    		exploreMu,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		keyView,
    		clearBoard,
    		currentUnderstanding,
    		viewNumber,
    		trial,
    		numTrials,
    		viewPortScale,
    		blockSize,
    		range,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		handleKeydown,
    		nextInstruction,
    		getData
    	];
    }

    class PracticeGame extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$4,
    			create_fragment$4,
    			safe_not_equal,
    			{
    				counter: 0,
    				viewNumber: 10,
    				nextInstruction: 21,
    				getData: 22,
    				viewExplore: 1,
    				exploitMu: 2,
    				exploreMu: 3,
    				exploreSelect: 4,
    				exploitSelect: 5,
    				replaceExploit: 6,
    				keyView: 7,
    				clearBoard: 8,
    				currentUnderstanding: 9
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PracticeGame",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*nextInstruction*/ ctx[21] === undefined && !("nextInstruction" in props)) {
    			console_1$3.warn("<PracticeGame> was created without expected prop 'nextInstruction'");
    		}

    		if (/*getData*/ ctx[22] === undefined && !("getData" in props)) {
    			console_1$3.warn("<PracticeGame> was created without expected prop 'getData'");
    		}
    	}

    	get counter() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set counter(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewNumber() {
    		return this.$$.ctx[10];
    	}

    	set viewNumber(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nextInstruction() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nextInstruction(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getData() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getData(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewExplore() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set viewExplore(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitMu() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitMu(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploreMu() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploreMu(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploreSelect() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploreSelect(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exploitSelect() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exploitSelect(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replaceExploit() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replaceExploit(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get keyView() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set keyView(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get clearBoard() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clearBoard(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get currentUnderstanding() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentUnderstanding(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/Instructions.svelte generated by Svelte v3.34.0 */

    const { console: console_1$2 } = globals;
    const file$1 = "src/Instructions/Instructions.svelte";

    // (70:0) {#if i===0}
    function create_if_block_32(ctx) {
    	let fullscreen;
    	let current;

    	fullscreen = new FullScreen({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(fullscreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fullscreen, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fullscreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fullscreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fullscreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_32.name,
    		type: "if",
    		source: "(70:0) {#if i===0}",
    		ctx
    	});

    	return block;
    }

    // (73:0) {#if i===1}
    function create_if_block_31(ctx) {
    	let h1;
    	let t0;
    	let br;
    	let t1;
    	let t2;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("The ");
    			br = element("br");
    			t1 = text("Teaching Task");
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			add_location(br, file$1, 73, 113, 2480);
    			set_style(h1, "width", "100%");
    			set_style(h1, "height", "25%");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "font-size", "200px");
    			set_style(h1, "font", "Helvetica");
    			set_style(h1, "color", "black");
    			add_location(h1, file$1, 73, 4, 2371);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, br);
    			append_dev(h1, t1);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_31.name,
    		type: "if",
    		source: "(73:0) {#if i===1}",
    		ctx
    	});

    	return block;
    }

    // (77:0) {#if i ===2}
    function create_if_block_30(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "For this experiment, you will play a teaching task.  Please read through these instructions carefully.\n         Remember that this is an important part of our study. Please give this task adequate time and effort, and try to get the best results.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "width", "100%");
    			set_style(h1, "height", "25%");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "font", "40px Helvetica");
    			set_style(h1, "color", "black");
    			add_location(h1, file$1, 77, 4, 2586);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_30.name,
    		type: "if",
    		source: "(77:0) {#if i ===2}",
    		ctx
    	});

    	return block;
    }

    // (84:0) {#if i ===3}
    function create_if_block_29(ctx) {
    	let h1;
    	let t1;
    	let textarea;
    	let t2;
    	let button0;
    	let t4;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "To start off, we want you to take a moment to think about and describe your current math warm up in 1 or 2 sentences.";
    			t1 = space();
    			textarea = element("textarea");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Next Instruction";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Previous Instruction";
    			set_style(h1, "width", "100%");
    			set_style(h1, "height", "25%");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "font", "40px Helvetica");
    			set_style(h1, "color", "black");
    			add_location(h1, file$1, 84, 0, 3074);
    			attr_dev(textarea, "rows", "4");
    			attr_dev(textarea, "wrap", "soft");
    			set_style(textarea, "left", "calc(50vw + -250px)");
    			set_style(textarea, "width", "500px");
    			set_style(textarea, "height", "300px");
    			set_style(textarea, "font", "25px Helvetica");
    			set_style(textarea, "position", "absolute");
    			add_location(textarea, file$1, 87, 4, 3303);
    			attr_dev(button0, "class", "prettyButton svelte-12lksnk");
    			set_style(button0, "position", "absolute");
    			set_style(button0, "left", "calc(75vw + -200px)");
    			set_style(button0, "top", "calc(100vh + -150px)");
    			add_location(button0, file$1, 88, 4, 3470);
    			attr_dev(button1, "class", "prettyButton svelte-12lksnk");
    			set_style(button1, "position", "absolute");
    			set_style(button1, "left", "calc(25vw + -200px)");
    			set_style(button1, "top", "calc(100vh + -150px)");
    			add_location(button1, file$1, 89, 4, 3635);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*warmUp*/ ctx[3]);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[11]),
    					listen_dev(button0, "click", /*nextInstruction*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*previousInstruction*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*warmUp*/ 8) {
    				set_input_value(textarea, /*warmUp*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(textarea);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_29.name,
    		type: "if",
    		source: "(84:0) {#if i ===3}",
    		ctx
    	});

    	return block;
    }

    // (92:0) {#if i ===4}
    function create_if_block_28(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Now, we want you to imagine that your math coach or colleague has suggested a new approach for your math warm up.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "width", "100%");
    			set_style(h1, "height", "25%");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "font", "40px Helvetica");
    			set_style(h1, "color", "black");
    			add_location(h1, file$1, 92, 0, 3822);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_28.name,
    		type: "if",
    		source: "(92:0) {#if i ===4}",
    		ctx
    	});

    	return block;
    }

    // (98:0) {#if i ===5}
    function create_if_block_27(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "In this experiment  - the teaching task - we would like you to choose between two teaching approaches for your math warm up, (1) your current math warm up that seems to be working well or (2) the “new” suggested approach for your math warm up.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "width", "100%");
    			set_style(h1, "height", "25%");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "font", "40px Helvetica");
    			set_style(h1, "color", "black");
    			add_location(h1, file$1, 98, 0, 4156);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_27.name,
    		type: "if",
    		source: "(98:0) {#if i ===5}",
    		ctx
    	});

    	return block;
    }

    // (103:0) {#if i ===6}
    function create_if_block_26(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "For the purposes of this task, we will keep the teaching approaches generic (“current” Approach or “new” Approach by the coach) but we want you to imagine what those approaches might be (i.e. starting with a group problem, a quick review worksheet, calendar time, or a math discussion).";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "width", "100%");
    			set_style(h1, "height", "25%");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "font", "40px Helvetica");
    			set_style(h1, "color", "black");
    			add_location(h1, file$1, 103, 4, 4627);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_26.name,
    		type: "if",
    		source: "(103:0) {#if i ===6}",
    		ctx
    	});

    	return block;
    }

    // (109:0) {#if i ===7}
    function create_if_block_25(ctx) {
    	let h10;
    	let t1;
    	let div;
    	let h11;
    	let t3;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "To get feedback on how well the approach worked, your students will display a red light or green light to show their understanding.";
    			t1 = space();
    			div = element("div");
    			h11 = element("h1");
    			h11.textContent = "How much did you understand?";
    			t3 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h10, "width", "100%");
    			set_style(h10, "height", "25%");
    			set_style(h10, "text-align", "center");
    			set_style(h10, "font", "40px Helvetica");
    			set_style(h10, "color", "black");
    			add_location(h10, file$1, 109, 4, 5149);
    			set_style(h11, "text-align", "center");
    			add_location(h11, file$1, 113, 8, 5546);
    			set_style(div, "position", "absolute");
    			set_style(div, "top", "calc(50vh + -250px)");
    			set_style(div, "left", "calc(50vw + -400px)");
    			set_style(div, "width", "800px");
    			set_style(div, "height", "500px");
    			set_style(div, "border", "solid black 5px");
    			add_location(div, file$1, 112, 4, 5398);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, h11);
    			insert_dev(target, t3, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t3);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_25.name,
    		type: "if",
    		source: "(109:0) {#if i ===7}",
    		ctx
    	});

    	return block;
    }

    // (118:0) {#if i ===8}
    function create_if_block_24(ctx) {
    	let h10;
    	let t1;
    	let div2;
    	let h11;
    	let t3;
    	let div0;
    	let h12;
    	let t5;
    	let div1;
    	let h13;
    	let t7;
    	let h14;
    	let t9;
    	let h15;
    	let t11;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "The response of a student holding up a red or green card after being asked might be like:";
    			t1 = space();
    			div2 = element("div");
    			h11 = element("h1");
    			h11.textContent = "How much did you understand?";
    			t3 = space();
    			div0 = element("div");
    			h12 = element("h1");
    			h12.textContent = "R";
    			t5 = space();
    			div1 = element("div");
    			h13 = element("h1");
    			h13.textContent = "G";
    			t7 = space();
    			h14 = element("h1");
    			h14.textContent = "I don’t get it! This did not help me.";
    			t9 = space();
    			h15 = element("h1");
    			h15.textContent = "I understand!  \n            I am happy with how this went.";
    			t11 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h10, "width", "100%");
    			set_style(h10, "height", "25%");
    			set_style(h10, "text-align", "center");
    			set_style(h10, "font", "40px Helvetica");
    			set_style(h10, "color", "black");
    			add_location(h10, file$1, 118, 4, 5745);
    			set_style(h11, "width", "100%");
    			set_style(h11, "text-align", "center");
    			add_location(h11, file$1, 122, 8, 6098);
    			set_style(h12, "top", "-15px");
    			set_style(h12, "position", "absolute");
    			set_style(h12, "text-align", "center");
    			set_style(h12, "width", "100px");
    			add_location(h12, file$1, 124, 12, 6335);
    			set_style(div0, "position", "absolute");
    			set_style(div0, "top", "50px");
    			set_style(div0, "left", "50px");
    			set_style(div0, "width", "100px");
    			set_style(div0, "height", "100px");
    			set_style(div0, "background-color", "red");
    			set_style(div0, "border-radius", "50%");
    			set_style(div0, "font-size", "25px");
    			add_location(div0, file$1, 123, 8, 6182);
    			set_style(h13, "top", "-15px");
    			set_style(h13, "position", "absolute");
    			set_style(h13, "width", "100px");
    			set_style(h13, "text-align", "center");
    			add_location(h13, file$1, 127, 12, 6592);
    			set_style(div1, "position", "absolute");
    			set_style(div1, "top", "250px");
    			set_style(div1, "left", "50px");
    			set_style(div1, "width", "100px");
    			set_style(div1, "height", "100px");
    			set_style(div1, "background-color", "green");
    			set_style(div1, "border-radius", "50%");
    			set_style(div1, "font-size", "25px");
    			add_location(div1, file$1, 126, 8, 6435);
    			set_style(h14, "position", "absolute");
    			set_style(h14, "top", "50px");
    			set_style(h14, "left", "200px");
    			set_style(h14, "width", "400px");
    			set_style(h14, "height", "100px");
    			set_style(h14, "border", "solid black 5px");
    			add_location(h14, file$1, 129, 8, 6693);
    			set_style(h15, "position", "absolute");
    			set_style(h15, "top", "250px");
    			set_style(h15, "left", "200px");
    			set_style(h15, "width", "400px");
    			set_style(h15, "height", "100px");
    			set_style(h15, "border", "solid black 5px");
    			add_location(h15, file$1, 132, 8, 6877);
    			set_style(div2, "position", "absolute");
    			set_style(div2, "top", "calc(50vh + -250px)");
    			set_style(div2, "left", "calc(50vw + -400px)");
    			set_style(div2, "width", "800px");
    			set_style(div2, "height", "500px");
    			set_style(div2, "border", "solid black 5px");
    			add_location(div2, file$1, 121, 4, 5950);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h11);
    			append_dev(div2, t3);
    			append_dev(div2, div0);
    			append_dev(div0, h12);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, h13);
    			append_dev(div2, t7);
    			append_dev(div2, h14);
    			append_dev(div2, t9);
    			append_dev(div2, h15);
    			insert_dev(target, t11, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t11);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_24.name,
    		type: "if",
    		source: "(118:0) {#if i ===8}",
    		ctx
    	});

    	return block;
    }

    // (139:0) {#if i ===9}
    function create_if_block_23(ctx) {
    	let singlechoice;
    	let t;
    	let navigationbuttons;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "You have a class of 20 students.  Each student is represented by a circle.  The same move can have different outcomes day to day. For example, you might get 12 green and 8 red the first day your try the same move (shown below)",
    				exploitSelect: false,
    				exploitMu: 12
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(singlechoice.$$.fragment);
    			t = space();
    			create_component(navigationbuttons.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(singlechoice, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(singlechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(singlechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(singlechoice, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_23.name,
    		type: "if",
    		source: "(139:0) {#if i ===9}",
    		ctx
    	});

    	return block;
    }

    // (143:0) {#if i ===10}
    function create_if_block_22(ctx) {
    	let singlechoice;
    	let t;
    	let navigationbuttons;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "And the second day you try the same move you might not work so well - 9 students showing green and 11 showing red.",
    				exploitSelect: false,
    				exploitMu: 9
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(singlechoice.$$.fragment);
    			t = space();
    			create_component(navigationbuttons.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(singlechoice, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(singlechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(singlechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(singlechoice, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_22.name,
    		type: "if",
    		source: "(143:0) {#if i ===10}",
    		ctx
    	});

    	return block;
    }

    // (147:0) {#if i ===11}
    function create_if_block_21(ctx) {
    	let singlechoice;
    	let t;
    	let navigationbuttons;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "And on the third day you try the same move you might get slightly better results - 15 students showing green and 5 showing red",
    				exploitSelect: false,
    				exploitMu: 15
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(singlechoice.$$.fragment);
    			t = space();
    			create_component(navigationbuttons.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(singlechoice, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(singlechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(singlechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(singlechoice, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_21.name,
    		type: "if",
    		source: "(147:0) {#if i ===11}",
    		ctx
    	});

    	return block;
    }

    // (151:0) {#if i ===12}
    function create_if_block_20(ctx) {
    	let singlechoice;
    	let t0;
    	let navigationbuttons;
    	let t1;
    	let h1;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "And on the third day you try the same move you might get slightly better results - 15 students showing green and 5 showing red",
    				exploitSelect: false,
    				exploitMu: 15
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(singlechoice.$$.fragment);
    			t0 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			h1.textContent = "As you can see, the same move can get slightly better or worse results over time but stays fairly close to what it was the day before.";
    			set_style(h1, "width", "100%");
    			set_style(h1, "top", "calc(100vh + -200px)");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$1, 153, 4, 8548);
    		},
    		m: function mount(target, anchor) {
    			mount_component(singlechoice, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h1, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(singlechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(singlechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(singlechoice, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_20.name,
    		type: "if",
    		source: "(151:0) {#if i ===12}",
    		ctx
    	});

    	return block;
    }

    // (156:0) {#if i ===13}
    function create_if_block_19(ctx) {
    	let singlechoice;
    	let t0;
    	let navigationbuttons;
    	let t1;
    	let h1;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "And on the fourth day you try the same move and again, get slightly different results - 16 students showing green and 4 showing red",
    				exploitSelect: false,
    				exploitMu: 16
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(singlechoice.$$.fragment);
    			t0 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			h1.textContent = "**Important note**  Yesterday’s outcome is the best predictor of today’s outcome.";
    			set_style(h1, "width", "100%");
    			set_style(h1, "top", "calc(100vh + -200px)");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$1, 158, 4, 9102);
    		},
    		m: function mount(target, anchor) {
    			mount_component(singlechoice, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h1, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(singlechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(singlechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(singlechoice, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_19.name,
    		type: "if",
    		source: "(156:0) {#if i ===13}",
    		ctx
    	});

    	return block;
    }

    // (161:0) {#if i === 14}
    function create_if_block_18(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationbuttons;
    	let current;
    	doublechoice = new DoubleChoice({ props: { exploitMu: 11 }, $$inline: true });

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "When you play the task, the two teaching approaches will be represented like this.  \n        Your current approach shows the outcome from the last time you used that approach.\n        The outcome from your new approach is unknown until you try it.";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "position", "absolute");
    			set_style(h1, "top", "0vh");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 161, 4, 9306);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_18.name,
    		type: "if",
    		source: "(161:0) {#if i === 14}",
    		ctx
    	});

    	return block;
    }

    // (169:0) {#if i ===15}
    function create_if_block_17(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				delayExploit: true,
    				exploitMu: 11
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "if you choose choose to continue with your current teaching approach, it will light up with a blue border and a new outcome will appear.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			create_component(doublechoice.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 169, 4, 9791);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_17.name,
    		type: "if",
    		source: "(169:0) {#if i ===15}",
    		ctx
    	});

    	return block;
    }

    // (175:0) {#if i ===16}
    function create_if_block_16(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				exploreSelect: true,
    				viewExplore: true,
    				exploitMu: 11
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Or, for example, if you choose to switch to the NEW approach, it will light up and show the results like this…";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			create_component(doublechoice.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 175, 0, 10201);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_16.name,
    		type: "if",
    		source: "(175:0) {#if i ===16}",
    		ctx
    	});

    	return block;
    }

    // (181:0) {#if i === 17}
    function create_if_block_15(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				delayBadExplore: true,
    				exploitMu: 11,
    				noReplaceExplore: true
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "If the new approach is worse than the current approach, you earn fewer points on this trial but because it is worse, this new approach is discarded.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			create_component(doublechoice.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 181, 4, 10596);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_15.name,
    		type: "if",
    		source: "(181:0) {#if i === 17}",
    		ctx
    	});

    	return block;
    }

    // (187:0) {#if i === 18}
    function create_if_block_14(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				exploitMu: 11
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Then another new approach will appear. Now you can choose again from the current approach or another new approach.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			create_component(doublechoice.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 187, 4, 11048);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_14.name,
    		type: "if",
    		source: "(187:0) {#if i === 18}",
    		ctx
    	});

    	return block;
    }

    // (193:0) {#if i === 19}
    function create_if_block_13(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				delayGoodExplore: true,
    				exploitMu: 11,
    				exploreMu: 16,
    				noReplaceExplore: true
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "If you were to try the NEW approach and it is better than the current approach,  it will replace your current approach for your next choice.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			create_component(doublechoice.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 193, 4, 11419);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(193:0) {#if i === 19}",
    		ctx
    	});

    	return block;
    }

    // (199:0) {#if i === 20}
    function create_if_block_12(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				exploitMu: 16
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Once again, another new approach will appear... and so on...";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			create_component(doublechoice.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 199, 4, 11880);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(199:0) {#if i === 20}",
    		ctx
    	});

    	return block;
    }

    // (205:0) {#if i === 21}
    function create_if_block_11(ctx) {
    	let h10;
    	let t1;
    	let h11;
    	let t3;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "Your current classroom's understanding will be displayed above your choices. This serves as a visual aid to help you remember your latest choice, it does not give you any additional information. It is based on proportion of green-light students you have out of your total class size of 20.\n        For example, if on your last turn, 15 of 20 students showed green lights, the display would look like this:";
    			t1 = space();
    			h11 = element("h1");
    			h11.textContent = "Current Classroom Understanding: 75%";
    			t3 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h10, "text-align", "center");
    			set_style(h10, "width", "100%");
    			add_location(h10, file$1, 205, 4, 12197);
    			set_style(h11, "position", "absolute");
    			set_style(h11, "top", "50vh");
    			set_style(h11, "left", "calc(50vw + -400px)");
    			set_style(h11, "width", "800px");
    			set_style(h11, "height", "50px");
    			set_style(h11, "text-align", "center");
    			set_style(h11, "border", "solid black 2px");
    			add_location(h11, file$1, 208, 4, 12658);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h11, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t3);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(205:0) {#if i === 21}",
    		ctx
    	});

    	return block;
    }

    // (213:0) {#if i === 22}
    function create_if_block_10(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "To recap, you need to choose between you current approach and a new approach.  Choosing you current approach gives you a similar result to what you got last time (slightly better or worse.)  Choosing a new approach give you a totally new outcome(that can be a lot better or a lot worse).";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 213, 4, 12963);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(213:0) {#if i === 22}",
    		ctx
    	});

    	return block;
    }

    // (218:0) {#if i === 23}
    function create_if_block_9(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Lets try a couple of guided trials to solidify your understanding...";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 218, 4, 13428);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(218:0) {#if i === 23}",
    		ctx
    	});

    	return block;
    }

    // (223:0) {#if i === 24}
    function create_if_block_8(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationbuttons;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				exploitMu: 12,
    				keyDisplay: true
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5],
    				forwardKey: "ArrowLeft",
    				display: false
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "For our first trial we have a current teaching approach that seems to be working fairly well, so we may want to stick with our current approach (press the left arrow)";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 223, 4, 13674);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(223:0) {#if i === 24}",
    		ctx
    	});

    	return block;
    }

    // (228:0) {#if i=== 25}
    function create_if_block_7(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationbuttons;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				keyDisplay: true,
    				delayExploit: true,
    				exploitMu: 12,
    				exploitMu2: 13,
    				delayTime: 0
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5],
    				forwardKey: "ArrowLeft",
    				display: false
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "We can see that when we tried our current teaching approach it got better! So, we may want to keep trying the approach (press the left arrow)";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 228, 4, 14148);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(228:0) {#if i=== 25}",
    		ctx
    	});

    	return block;
    }

    // (233:0) {#if i=== 26}
    function create_if_block_6(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationbuttons;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				keyDisplay: true,
    				delayExploit: true,
    				exploitMu: 13,
    				exploitMu2: 8,
    				delayTime: 0
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5],
    				forwardKey: "ArrowRight",
    				display: false
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Oh no! We seem to have gotten a bad outcome that time. Since our current choice is not performing well we may want to switch to a new approach (press the right arrow)";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 233, 4, 14647);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(233:0) {#if i=== 26}",
    		ctx
    	});

    	return block;
    }

    // (238:0) {#if i=== 27}
    function create_if_block_5(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationbuttons;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				keyDisplay: true,
    				delayBadExplore: true,
    				exploitMu: 8,
    				exploreMu: 1,
    				delayTime: 0
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5],
    				forwardKey: "ArrowRight",
    				display: false
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "After trying the new approach, we got a worse outcome than our current approach. We may still think that there are better options out there though, and we decide to try another new approach (press the right arrow)";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 238, 4, 15171);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(238:0) {#if i=== 27}",
    		ctx
    	});

    	return block;
    }

    // (243:0) {#if i=== 28}
    function create_if_block_4(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationbuttons;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[6],
    				keyDisplay: false,
    				delayGoodExplore: true,
    				exploitMu: 8,
    				exploreMu: 15,
    				delayTime: 0,
    				viewExplore: true
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5],
    				backSkip: 5
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Great! We seem to have found a much better approach when we tried another new approach... And we could continue a similar line of reasoning until we have finished all the trials";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 243, 4, 15743);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(243:0) {#if i=== 28}",
    		ctx
    	});

    	return block;
    }

    // (248:0) {#if i === 29}
    function create_if_block_3$1(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Now that you've seen how a game might play out, lets have you do a couple of rounds by yourself. The classroom understanding bar will be added into these trials.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 248, 4, 16276);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(248:0) {#if i === 29}",
    		ctx
    	});

    	return block;
    }

    // (253:0) {#if i === 30}
    function create_if_block_2$2(ctx) {
    	let practicegame;
    	let current;

    	practicegame = new PracticeGame({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				getData: /*sendGameUpstream*/ ctx[7]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(practicegame.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(practicegame, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(practicegame.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(practicegame.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(practicegame, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(253:0) {#if i === 30}",
    		ctx
    	});

    	return block;
    }

    // (256:0) {#if i === 31}
    function create_if_block_1$2(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[4],
    				previousInstruction: /*previousInstruction*/ ctx[5],
    				backSkip: 2
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "At this point you should have a firm understanding of the task. This task will go for 300 trials. Remember to maximize your students' understanding, and good luck! To review any of the instructions press B, to continue to the task press SPACE.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			set_style(h1, "text-align", "center");
    			set_style(h1, "width", "100%");
    			add_location(h1, file$1, 256, 4, 16717);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(256:0) {#if i === 31}",
    		ctx
    	});

    	return block;
    }

    // (261:0) {#if i === 32}
    function create_if_block$2(ctx) {
    	let t_value = /*toGame*/ ctx[2]() + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*toGame*/ 4 && t_value !== (t_value = /*toGame*/ ctx[2]() + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(261:0) {#if i === 32}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let t21;
    	let t22;
    	let t23;
    	let t24;
    	let t25;
    	let t26;
    	let t27;
    	let t28;
    	let t29;
    	let t30;
    	let t31;
    	let if_block32_anchor;
    	let current;
    	let if_block0 = /*i*/ ctx[0] === 0 && create_if_block_32(ctx);
    	let if_block1 = /*i*/ ctx[0] === 1 && create_if_block_31(ctx);
    	let if_block2 = /*i*/ ctx[0] === 2 && create_if_block_30(ctx);
    	let if_block3 = /*i*/ ctx[0] === 3 && create_if_block_29(ctx);
    	let if_block4 = /*i*/ ctx[0] === 4 && create_if_block_28(ctx);
    	let if_block5 = /*i*/ ctx[0] === 5 && create_if_block_27(ctx);
    	let if_block6 = /*i*/ ctx[0] === 6 && create_if_block_26(ctx);
    	let if_block7 = /*i*/ ctx[0] === 7 && create_if_block_25(ctx);
    	let if_block8 = /*i*/ ctx[0] === 8 && create_if_block_24(ctx);
    	let if_block9 = /*i*/ ctx[0] === 9 && create_if_block_23(ctx);
    	let if_block10 = /*i*/ ctx[0] === 10 && create_if_block_22(ctx);
    	let if_block11 = /*i*/ ctx[0] === 11 && create_if_block_21(ctx);
    	let if_block12 = /*i*/ ctx[0] === 12 && create_if_block_20(ctx);
    	let if_block13 = /*i*/ ctx[0] === 13 && create_if_block_19(ctx);
    	let if_block14 = /*i*/ ctx[0] === 14 && create_if_block_18(ctx);
    	let if_block15 = /*i*/ ctx[0] === 15 && create_if_block_17(ctx);
    	let if_block16 = /*i*/ ctx[0] === 16 && create_if_block_16(ctx);
    	let if_block17 = /*i*/ ctx[0] === 17 && create_if_block_15(ctx);
    	let if_block18 = /*i*/ ctx[0] === 18 && create_if_block_14(ctx);
    	let if_block19 = /*i*/ ctx[0] === 19 && create_if_block_13(ctx);
    	let if_block20 = /*i*/ ctx[0] === 20 && create_if_block_12(ctx);
    	let if_block21 = /*i*/ ctx[0] === 21 && create_if_block_11(ctx);
    	let if_block22 = /*i*/ ctx[0] === 22 && create_if_block_10(ctx);
    	let if_block23 = /*i*/ ctx[0] === 23 && create_if_block_9(ctx);
    	let if_block24 = /*i*/ ctx[0] === 24 && create_if_block_8(ctx);
    	let if_block25 = /*i*/ ctx[0] === 25 && create_if_block_7(ctx);
    	let if_block26 = /*i*/ ctx[0] === 26 && create_if_block_6(ctx);
    	let if_block27 = /*i*/ ctx[0] === 27 && create_if_block_5(ctx);
    	let if_block28 = /*i*/ ctx[0] === 28 && create_if_block_4(ctx);
    	let if_block29 = /*i*/ ctx[0] === 29 && create_if_block_3$1(ctx);
    	let if_block30 = /*i*/ ctx[0] === 30 && create_if_block_2$2(ctx);
    	let if_block31 = /*i*/ ctx[0] === 31 && create_if_block_1$2(ctx);
    	let if_block32 = /*i*/ ctx[0] === 32 && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			t3 = space();
    			if (if_block4) if_block4.c();
    			t4 = space();
    			if (if_block5) if_block5.c();
    			t5 = space();
    			if (if_block6) if_block6.c();
    			t6 = space();
    			if (if_block7) if_block7.c();
    			t7 = space();
    			if (if_block8) if_block8.c();
    			t8 = space();
    			if (if_block9) if_block9.c();
    			t9 = space();
    			if (if_block10) if_block10.c();
    			t10 = space();
    			if (if_block11) if_block11.c();
    			t11 = space();
    			if (if_block12) if_block12.c();
    			t12 = space();
    			if (if_block13) if_block13.c();
    			t13 = space();
    			if (if_block14) if_block14.c();
    			t14 = space();
    			if (if_block15) if_block15.c();
    			t15 = space();
    			if (if_block16) if_block16.c();
    			t16 = space();
    			if (if_block17) if_block17.c();
    			t17 = space();
    			if (if_block18) if_block18.c();
    			t18 = space();
    			if (if_block19) if_block19.c();
    			t19 = space();
    			if (if_block20) if_block20.c();
    			t20 = space();
    			if (if_block21) if_block21.c();
    			t21 = space();
    			if (if_block22) if_block22.c();
    			t22 = space();
    			if (if_block23) if_block23.c();
    			t23 = space();
    			if (if_block24) if_block24.c();
    			t24 = space();
    			if (if_block25) if_block25.c();
    			t25 = space();
    			if (if_block26) if_block26.c();
    			t26 = space();
    			if (if_block27) if_block27.c();
    			t27 = space();
    			if (if_block28) if_block28.c();
    			t28 = space();
    			if (if_block29) if_block29.c();
    			t29 = space();
    			if (if_block30) if_block30.c();
    			t30 = space();
    			if (if_block31) if_block31.c();
    			t31 = space();
    			if (if_block32) if_block32.c();
    			if_block32_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev(target, t3, anchor);
    			if (if_block4) if_block4.m(target, anchor);
    			insert_dev(target, t4, anchor);
    			if (if_block5) if_block5.m(target, anchor);
    			insert_dev(target, t5, anchor);
    			if (if_block6) if_block6.m(target, anchor);
    			insert_dev(target, t6, anchor);
    			if (if_block7) if_block7.m(target, anchor);
    			insert_dev(target, t7, anchor);
    			if (if_block8) if_block8.m(target, anchor);
    			insert_dev(target, t8, anchor);
    			if (if_block9) if_block9.m(target, anchor);
    			insert_dev(target, t9, anchor);
    			if (if_block10) if_block10.m(target, anchor);
    			insert_dev(target, t10, anchor);
    			if (if_block11) if_block11.m(target, anchor);
    			insert_dev(target, t11, anchor);
    			if (if_block12) if_block12.m(target, anchor);
    			insert_dev(target, t12, anchor);
    			if (if_block13) if_block13.m(target, anchor);
    			insert_dev(target, t13, anchor);
    			if (if_block14) if_block14.m(target, anchor);
    			insert_dev(target, t14, anchor);
    			if (if_block15) if_block15.m(target, anchor);
    			insert_dev(target, t15, anchor);
    			if (if_block16) if_block16.m(target, anchor);
    			insert_dev(target, t16, anchor);
    			if (if_block17) if_block17.m(target, anchor);
    			insert_dev(target, t17, anchor);
    			if (if_block18) if_block18.m(target, anchor);
    			insert_dev(target, t18, anchor);
    			if (if_block19) if_block19.m(target, anchor);
    			insert_dev(target, t19, anchor);
    			if (if_block20) if_block20.m(target, anchor);
    			insert_dev(target, t20, anchor);
    			if (if_block21) if_block21.m(target, anchor);
    			insert_dev(target, t21, anchor);
    			if (if_block22) if_block22.m(target, anchor);
    			insert_dev(target, t22, anchor);
    			if (if_block23) if_block23.m(target, anchor);
    			insert_dev(target, t23, anchor);
    			if (if_block24) if_block24.m(target, anchor);
    			insert_dev(target, t24, anchor);
    			if (if_block25) if_block25.m(target, anchor);
    			insert_dev(target, t25, anchor);
    			if (if_block26) if_block26.m(target, anchor);
    			insert_dev(target, t26, anchor);
    			if (if_block27) if_block27.m(target, anchor);
    			insert_dev(target, t27, anchor);
    			if (if_block28) if_block28.m(target, anchor);
    			insert_dev(target, t28, anchor);
    			if (if_block29) if_block29.m(target, anchor);
    			insert_dev(target, t29, anchor);
    			if (if_block30) if_block30.m(target, anchor);
    			insert_dev(target, t30, anchor);
    			if (if_block31) if_block31.m(target, anchor);
    			insert_dev(target, t31, anchor);
    			if (if_block32) if_block32.m(target, anchor);
    			insert_dev(target, if_block32_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*i*/ ctx[0] === 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_32(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_31(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 2) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_30(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(t2.parentNode, t2);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 3) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_29(ctx);
    					if_block3.c();
    					if_block3.m(t3.parentNode, t3);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*i*/ ctx[0] === 4) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block_28(ctx);
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(t4.parentNode, t4);
    				}
    			} else if (if_block4) {
    				group_outros();

    				transition_out(if_block4, 1, 1, () => {
    					if_block4 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 5) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block5, 1);
    					}
    				} else {
    					if_block5 = create_if_block_27(ctx);
    					if_block5.c();
    					transition_in(if_block5, 1);
    					if_block5.m(t5.parentNode, t5);
    				}
    			} else if (if_block5) {
    				group_outros();

    				transition_out(if_block5, 1, 1, () => {
    					if_block5 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 6) {
    				if (if_block6) {
    					if_block6.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block6, 1);
    					}
    				} else {
    					if_block6 = create_if_block_26(ctx);
    					if_block6.c();
    					transition_in(if_block6, 1);
    					if_block6.m(t6.parentNode, t6);
    				}
    			} else if (if_block6) {
    				group_outros();

    				transition_out(if_block6, 1, 1, () => {
    					if_block6 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 7) {
    				if (if_block7) {
    					if_block7.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block7, 1);
    					}
    				} else {
    					if_block7 = create_if_block_25(ctx);
    					if_block7.c();
    					transition_in(if_block7, 1);
    					if_block7.m(t7.parentNode, t7);
    				}
    			} else if (if_block7) {
    				group_outros();

    				transition_out(if_block7, 1, 1, () => {
    					if_block7 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 8) {
    				if (if_block8) {
    					if_block8.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block8, 1);
    					}
    				} else {
    					if_block8 = create_if_block_24(ctx);
    					if_block8.c();
    					transition_in(if_block8, 1);
    					if_block8.m(t8.parentNode, t8);
    				}
    			} else if (if_block8) {
    				group_outros();

    				transition_out(if_block8, 1, 1, () => {
    					if_block8 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 9) {
    				if (if_block9) {
    					if_block9.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block9, 1);
    					}
    				} else {
    					if_block9 = create_if_block_23(ctx);
    					if_block9.c();
    					transition_in(if_block9, 1);
    					if_block9.m(t9.parentNode, t9);
    				}
    			} else if (if_block9) {
    				group_outros();

    				transition_out(if_block9, 1, 1, () => {
    					if_block9 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 10) {
    				if (if_block10) {
    					if_block10.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block10, 1);
    					}
    				} else {
    					if_block10 = create_if_block_22(ctx);
    					if_block10.c();
    					transition_in(if_block10, 1);
    					if_block10.m(t10.parentNode, t10);
    				}
    			} else if (if_block10) {
    				group_outros();

    				transition_out(if_block10, 1, 1, () => {
    					if_block10 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 11) {
    				if (if_block11) {
    					if_block11.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block11, 1);
    					}
    				} else {
    					if_block11 = create_if_block_21(ctx);
    					if_block11.c();
    					transition_in(if_block11, 1);
    					if_block11.m(t11.parentNode, t11);
    				}
    			} else if (if_block11) {
    				group_outros();

    				transition_out(if_block11, 1, 1, () => {
    					if_block11 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 12) {
    				if (if_block12) {
    					if_block12.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block12, 1);
    					}
    				} else {
    					if_block12 = create_if_block_20(ctx);
    					if_block12.c();
    					transition_in(if_block12, 1);
    					if_block12.m(t12.parentNode, t12);
    				}
    			} else if (if_block12) {
    				group_outros();

    				transition_out(if_block12, 1, 1, () => {
    					if_block12 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 13) {
    				if (if_block13) {
    					if_block13.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block13, 1);
    					}
    				} else {
    					if_block13 = create_if_block_19(ctx);
    					if_block13.c();
    					transition_in(if_block13, 1);
    					if_block13.m(t13.parentNode, t13);
    				}
    			} else if (if_block13) {
    				group_outros();

    				transition_out(if_block13, 1, 1, () => {
    					if_block13 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 14) {
    				if (if_block14) {
    					if_block14.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block14, 1);
    					}
    				} else {
    					if_block14 = create_if_block_18(ctx);
    					if_block14.c();
    					transition_in(if_block14, 1);
    					if_block14.m(t14.parentNode, t14);
    				}
    			} else if (if_block14) {
    				group_outros();

    				transition_out(if_block14, 1, 1, () => {
    					if_block14 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 15) {
    				if (if_block15) {
    					if_block15.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block15, 1);
    					}
    				} else {
    					if_block15 = create_if_block_17(ctx);
    					if_block15.c();
    					transition_in(if_block15, 1);
    					if_block15.m(t15.parentNode, t15);
    				}
    			} else if (if_block15) {
    				group_outros();

    				transition_out(if_block15, 1, 1, () => {
    					if_block15 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 16) {
    				if (if_block16) {
    					if_block16.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block16, 1);
    					}
    				} else {
    					if_block16 = create_if_block_16(ctx);
    					if_block16.c();
    					transition_in(if_block16, 1);
    					if_block16.m(t16.parentNode, t16);
    				}
    			} else if (if_block16) {
    				group_outros();

    				transition_out(if_block16, 1, 1, () => {
    					if_block16 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 17) {
    				if (if_block17) {
    					if_block17.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block17, 1);
    					}
    				} else {
    					if_block17 = create_if_block_15(ctx);
    					if_block17.c();
    					transition_in(if_block17, 1);
    					if_block17.m(t17.parentNode, t17);
    				}
    			} else if (if_block17) {
    				group_outros();

    				transition_out(if_block17, 1, 1, () => {
    					if_block17 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 18) {
    				if (if_block18) {
    					if_block18.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block18, 1);
    					}
    				} else {
    					if_block18 = create_if_block_14(ctx);
    					if_block18.c();
    					transition_in(if_block18, 1);
    					if_block18.m(t18.parentNode, t18);
    				}
    			} else if (if_block18) {
    				group_outros();

    				transition_out(if_block18, 1, 1, () => {
    					if_block18 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 19) {
    				if (if_block19) {
    					if_block19.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block19, 1);
    					}
    				} else {
    					if_block19 = create_if_block_13(ctx);
    					if_block19.c();
    					transition_in(if_block19, 1);
    					if_block19.m(t19.parentNode, t19);
    				}
    			} else if (if_block19) {
    				group_outros();

    				transition_out(if_block19, 1, 1, () => {
    					if_block19 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 20) {
    				if (if_block20) {
    					if_block20.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block20, 1);
    					}
    				} else {
    					if_block20 = create_if_block_12(ctx);
    					if_block20.c();
    					transition_in(if_block20, 1);
    					if_block20.m(t20.parentNode, t20);
    				}
    			} else if (if_block20) {
    				group_outros();

    				transition_out(if_block20, 1, 1, () => {
    					if_block20 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 21) {
    				if (if_block21) {
    					if_block21.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block21, 1);
    					}
    				} else {
    					if_block21 = create_if_block_11(ctx);
    					if_block21.c();
    					transition_in(if_block21, 1);
    					if_block21.m(t21.parentNode, t21);
    				}
    			} else if (if_block21) {
    				group_outros();

    				transition_out(if_block21, 1, 1, () => {
    					if_block21 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 22) {
    				if (if_block22) {
    					if_block22.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block22, 1);
    					}
    				} else {
    					if_block22 = create_if_block_10(ctx);
    					if_block22.c();
    					transition_in(if_block22, 1);
    					if_block22.m(t22.parentNode, t22);
    				}
    			} else if (if_block22) {
    				group_outros();

    				transition_out(if_block22, 1, 1, () => {
    					if_block22 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 23) {
    				if (if_block23) {
    					if_block23.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block23, 1);
    					}
    				} else {
    					if_block23 = create_if_block_9(ctx);
    					if_block23.c();
    					transition_in(if_block23, 1);
    					if_block23.m(t23.parentNode, t23);
    				}
    			} else if (if_block23) {
    				group_outros();

    				transition_out(if_block23, 1, 1, () => {
    					if_block23 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 24) {
    				if (if_block24) {
    					if_block24.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block24, 1);
    					}
    				} else {
    					if_block24 = create_if_block_8(ctx);
    					if_block24.c();
    					transition_in(if_block24, 1);
    					if_block24.m(t24.parentNode, t24);
    				}
    			} else if (if_block24) {
    				group_outros();

    				transition_out(if_block24, 1, 1, () => {
    					if_block24 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 25) {
    				if (if_block25) {
    					if_block25.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block25, 1);
    					}
    				} else {
    					if_block25 = create_if_block_7(ctx);
    					if_block25.c();
    					transition_in(if_block25, 1);
    					if_block25.m(t25.parentNode, t25);
    				}
    			} else if (if_block25) {
    				group_outros();

    				transition_out(if_block25, 1, 1, () => {
    					if_block25 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 26) {
    				if (if_block26) {
    					if_block26.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block26, 1);
    					}
    				} else {
    					if_block26 = create_if_block_6(ctx);
    					if_block26.c();
    					transition_in(if_block26, 1);
    					if_block26.m(t26.parentNode, t26);
    				}
    			} else if (if_block26) {
    				group_outros();

    				transition_out(if_block26, 1, 1, () => {
    					if_block26 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 27) {
    				if (if_block27) {
    					if_block27.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block27, 1);
    					}
    				} else {
    					if_block27 = create_if_block_5(ctx);
    					if_block27.c();
    					transition_in(if_block27, 1);
    					if_block27.m(t27.parentNode, t27);
    				}
    			} else if (if_block27) {
    				group_outros();

    				transition_out(if_block27, 1, 1, () => {
    					if_block27 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 28) {
    				if (if_block28) {
    					if_block28.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block28, 1);
    					}
    				} else {
    					if_block28 = create_if_block_4(ctx);
    					if_block28.c();
    					transition_in(if_block28, 1);
    					if_block28.m(t28.parentNode, t28);
    				}
    			} else if (if_block28) {
    				group_outros();

    				transition_out(if_block28, 1, 1, () => {
    					if_block28 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 29) {
    				if (if_block29) {
    					if_block29.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block29, 1);
    					}
    				} else {
    					if_block29 = create_if_block_3$1(ctx);
    					if_block29.c();
    					transition_in(if_block29, 1);
    					if_block29.m(t29.parentNode, t29);
    				}
    			} else if (if_block29) {
    				group_outros();

    				transition_out(if_block29, 1, 1, () => {
    					if_block29 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 30) {
    				if (if_block30) {
    					if_block30.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block30, 1);
    					}
    				} else {
    					if_block30 = create_if_block_2$2(ctx);
    					if_block30.c();
    					transition_in(if_block30, 1);
    					if_block30.m(t30.parentNode, t30);
    				}
    			} else if (if_block30) {
    				group_outros();

    				transition_out(if_block30, 1, 1, () => {
    					if_block30 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 31) {
    				if (if_block31) {
    					if_block31.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block31, 1);
    					}
    				} else {
    					if_block31 = create_if_block_1$2(ctx);
    					if_block31.c();
    					transition_in(if_block31, 1);
    					if_block31.m(t31.parentNode, t31);
    				}
    			} else if (if_block31) {
    				group_outros();

    				transition_out(if_block31, 1, 1, () => {
    					if_block31 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 32) {
    				if (if_block32) {
    					if_block32.p(ctx, dirty);
    				} else {
    					if_block32 = create_if_block$2(ctx);
    					if_block32.c();
    					if_block32.m(if_block32_anchor.parentNode, if_block32_anchor);
    				}
    			} else if (if_block32) {
    				if_block32.d(1);
    				if_block32 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block4);
    			transition_in(if_block5);
    			transition_in(if_block6);
    			transition_in(if_block7);
    			transition_in(if_block8);
    			transition_in(if_block9);
    			transition_in(if_block10);
    			transition_in(if_block11);
    			transition_in(if_block12);
    			transition_in(if_block13);
    			transition_in(if_block14);
    			transition_in(if_block15);
    			transition_in(if_block16);
    			transition_in(if_block17);
    			transition_in(if_block18);
    			transition_in(if_block19);
    			transition_in(if_block20);
    			transition_in(if_block21);
    			transition_in(if_block22);
    			transition_in(if_block23);
    			transition_in(if_block24);
    			transition_in(if_block25);
    			transition_in(if_block26);
    			transition_in(if_block27);
    			transition_in(if_block28);
    			transition_in(if_block29);
    			transition_in(if_block30);
    			transition_in(if_block31);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block4);
    			transition_out(if_block5);
    			transition_out(if_block6);
    			transition_out(if_block7);
    			transition_out(if_block8);
    			transition_out(if_block9);
    			transition_out(if_block10);
    			transition_out(if_block11);
    			transition_out(if_block12);
    			transition_out(if_block13);
    			transition_out(if_block14);
    			transition_out(if_block15);
    			transition_out(if_block16);
    			transition_out(if_block17);
    			transition_out(if_block18);
    			transition_out(if_block19);
    			transition_out(if_block20);
    			transition_out(if_block21);
    			transition_out(if_block22);
    			transition_out(if_block23);
    			transition_out(if_block24);
    			transition_out(if_block25);
    			transition_out(if_block26);
    			transition_out(if_block27);
    			transition_out(if_block28);
    			transition_out(if_block29);
    			transition_out(if_block30);
    			transition_out(if_block31);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev(t3);
    			if (if_block4) if_block4.d(detaching);
    			if (detaching) detach_dev(t4);
    			if (if_block5) if_block5.d(detaching);
    			if (detaching) detach_dev(t5);
    			if (if_block6) if_block6.d(detaching);
    			if (detaching) detach_dev(t6);
    			if (if_block7) if_block7.d(detaching);
    			if (detaching) detach_dev(t7);
    			if (if_block8) if_block8.d(detaching);
    			if (detaching) detach_dev(t8);
    			if (if_block9) if_block9.d(detaching);
    			if (detaching) detach_dev(t9);
    			if (if_block10) if_block10.d(detaching);
    			if (detaching) detach_dev(t10);
    			if (if_block11) if_block11.d(detaching);
    			if (detaching) detach_dev(t11);
    			if (if_block12) if_block12.d(detaching);
    			if (detaching) detach_dev(t12);
    			if (if_block13) if_block13.d(detaching);
    			if (detaching) detach_dev(t13);
    			if (if_block14) if_block14.d(detaching);
    			if (detaching) detach_dev(t14);
    			if (if_block15) if_block15.d(detaching);
    			if (detaching) detach_dev(t15);
    			if (if_block16) if_block16.d(detaching);
    			if (detaching) detach_dev(t16);
    			if (if_block17) if_block17.d(detaching);
    			if (detaching) detach_dev(t17);
    			if (if_block18) if_block18.d(detaching);
    			if (detaching) detach_dev(t18);
    			if (if_block19) if_block19.d(detaching);
    			if (detaching) detach_dev(t19);
    			if (if_block20) if_block20.d(detaching);
    			if (detaching) detach_dev(t20);
    			if (if_block21) if_block21.d(detaching);
    			if (detaching) detach_dev(t21);
    			if (if_block22) if_block22.d(detaching);
    			if (detaching) detach_dev(t22);
    			if (if_block23) if_block23.d(detaching);
    			if (detaching) detach_dev(t23);
    			if (if_block24) if_block24.d(detaching);
    			if (detaching) detach_dev(t24);
    			if (if_block25) if_block25.d(detaching);
    			if (detaching) detach_dev(t25);
    			if (if_block26) if_block26.d(detaching);
    			if (detaching) detach_dev(t26);
    			if (if_block27) if_block27.d(detaching);
    			if (detaching) detach_dev(t27);
    			if (if_block28) if_block28.d(detaching);
    			if (detaching) detach_dev(t28);
    			if (if_block29) if_block29.d(detaching);
    			if (detaching) detach_dev(t29);
    			if (if_block30) if_block30.d(detaching);
    			if (detaching) detach_dev(t30);
    			if (if_block31) if_block31.d(detaching);
    			if (detaching) detach_dev(t31);
    			if (if_block32) if_block32.d(detaching);
    			if (detaching) detach_dev(if_block32_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function Send_Data_To_Exius$1(params, templateKey, writeKey) {
    	// [{endpoint:Horizon_CSV,data:data,fname:fname}]
    	try {
    		var fd = new FormData();

    		for (const fileInfo of params) {
    			//console.log(fileInfo)
    			let URL = new Blob([fileInfo.data], { type: "text/csv;charset=utf-8;" });

    			fd.append(fileInfo.endpoint, URL, fileInfo.fname);
    		}

    		let res = await fetch("https://exius.nrdlab.org/Upload", {
    			headers: {
    				authorization: `templateKey:${templateKey};writeKey:${writeKey}`
    			},
    			method: "POST",
    			body: fd
    		});

    		return await res.json();
    	} catch(e) {
    		console.log(e);
    		throw e;
    	}
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Instructions", slots, []);
    	let { toGame } = $$props;
    	let { i = 0 } = $$props;
    	let { breakTruth = { truth: false } } = $$props;
    	let { getData } = $$props;
    	let { writeKey } = $$props;
    	let { id } = $$props;
    	let practiceData = undefined;
    	let warmUp = "Input Text Here...";

    	function nextInstruction(n) {
    		console.log(typeof n == "number");
    		!(typeof n == "number") ? n = 1 : n = n;
    		console.log(n);
    		$$invalidate(0, i += n);
    	}

    	function previousInstruction(n) {
    		!(typeof n == "number") ? n = 1 : n = n;
    		console.log(n);
    		$$invalidate(0, i -= n);
    	}

    	function breakNav(value) {
    		$$invalidate(1, breakTruth.truth = value, breakTruth);
    		console.log(breakTruth.truth);
    	}

    	async function sendGameUpstream(data) {
    		getData(data);

    		console.log(await Send_Data_To_Exius$1(
    			[
    				{
    					endpoint: "TeacherCSV",
    					fname: `Subject_${id}.csv`,
    					data
    				}
    			],
    			"Teacher_Task",
    			writeKey
    		));
    	}

    	const writable_props = ["toGame", "i", "breakTruth", "getData", "writeKey", "id"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$2.warn(`<Instructions> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		warmUp = this.value;
    		$$invalidate(3, warmUp);
    	}

    	$$self.$$set = $$props => {
    		if ("toGame" in $$props) $$invalidate(2, toGame = $$props.toGame);
    		if ("i" in $$props) $$invalidate(0, i = $$props.i);
    		if ("breakTruth" in $$props) $$invalidate(1, breakTruth = $$props.breakTruth);
    		if ("getData" in $$props) $$invalidate(8, getData = $$props.getData);
    		if ("writeKey" in $$props) $$invalidate(9, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(10, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		NavigationButtons,
    		SingleChoice,
    		DoubleChoice,
    		FullScreen,
    		PracticeGame,
    		toGame,
    		i,
    		breakTruth,
    		getData,
    		writeKey,
    		id,
    		practiceData,
    		warmUp,
    		nextInstruction,
    		previousInstruction,
    		breakNav,
    		sendGameUpstream,
    		Send_Data_To_Exius: Send_Data_To_Exius$1
    	});

    	$$self.$inject_state = $$props => {
    		if ("toGame" in $$props) $$invalidate(2, toGame = $$props.toGame);
    		if ("i" in $$props) $$invalidate(0, i = $$props.i);
    		if ("breakTruth" in $$props) $$invalidate(1, breakTruth = $$props.breakTruth);
    		if ("getData" in $$props) $$invalidate(8, getData = $$props.getData);
    		if ("writeKey" in $$props) $$invalidate(9, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(10, id = $$props.id);
    		if ("practiceData" in $$props) practiceData = $$props.practiceData;
    		if ("warmUp" in $$props) $$invalidate(3, warmUp = $$props.warmUp);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*i, id, warmUp, writeKey*/ 1545) {
    			{
    				if (i === 4) {
    					console.log("Sending Response...");

    					Send_Data_To_Exius$1(
    						[
    							{
    								endpoint: "TeacherResponse",
    								fname: `Response_${id}.txt`,
    								data: warmUp
    							}
    						],
    						"Teacher_Task",
    						writeKey
    					);
    				}
    			}
    		}
    	};

    	return [
    		i,
    		breakTruth,
    		toGame,
    		warmUp,
    		nextInstruction,
    		previousInstruction,
    		breakNav,
    		sendGameUpstream,
    		getData,
    		writeKey,
    		id,
    		textarea_input_handler
    	];
    }

    class Instructions extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			toGame: 2,
    			i: 0,
    			breakTruth: 1,
    			getData: 8,
    			writeKey: 9,
    			id: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Instructions",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*toGame*/ ctx[2] === undefined && !("toGame" in props)) {
    			console_1$2.warn("<Instructions> was created without expected prop 'toGame'");
    		}

    		if (/*getData*/ ctx[8] === undefined && !("getData" in props)) {
    			console_1$2.warn("<Instructions> was created without expected prop 'getData'");
    		}

    		if (/*writeKey*/ ctx[9] === undefined && !("writeKey" in props)) {
    			console_1$2.warn("<Instructions> was created without expected prop 'writeKey'");
    		}

    		if (/*id*/ ctx[10] === undefined && !("id" in props)) {
    			console_1$2.warn("<Instructions> was created without expected prop 'id'");
    		}
    	}

    	get toGame() {
    		throw new Error("<Instructions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toGame(value) {
    		throw new Error("<Instructions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get i() {
    		throw new Error("<Instructions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set i(value) {
    		throw new Error("<Instructions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get breakTruth() {
    		throw new Error("<Instructions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set breakTruth(value) {
    		throw new Error("<Instructions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getData() {
    		throw new Error("<Instructions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getData(value) {
    		throw new Error("<Instructions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get writeKey() {
    		throw new Error("<Instructions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set writeKey(value) {
    		throw new Error("<Instructions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Instructions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Instructions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Redirect.svelte generated by Svelte v3.34.0 */

    function create_fragment$2(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Redirect", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Redirect> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Redirect extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Redirect",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/Password.svelte generated by Svelte v3.34.0 */

    const { Object: Object_1, console: console_1$1 } = globals;
    const file = "src/Password.svelte";

    // (63:0) {#if preflightInitiated}
    function create_if_block_2$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Checking Credentials...";
    			add_location(h1, file, 63, 4, 2337);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(63:0) {#if preflightInitiated}",
    		ctx
    	});

    	return block;
    }

    // (66:0) {#if preflightError}
    function create_if_block_1$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Error in preflight";
    			add_location(h1, file, 66, 4, 2401);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(66:0) {#if preflightError}",
    		ctx
    	});

    	return block;
    }

    // (69:0) {#if Object.keys(preflightFileFail).length !== 0}
    function create_if_block$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "preflightFileFail";
    			add_location(h1, file, 69, 4, 2489);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(69:0) {#if Object.keys(preflightFileFail).length !== 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let t0;
    	let t1;
    	let show_if = Object.keys(/*preflightFileFail*/ ctx[1]).length !== 0;
    	let if_block2_anchor;
    	let if_block0 = /*preflightInitiated*/ ctx[0] && create_if_block_2$1(ctx);
    	let if_block1 = /*preflightError*/ ctx[2] && create_if_block_1$1(ctx);
    	let if_block2 = show_if && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			if_block2_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, if_block2_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*preflightInitiated*/ ctx[0]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_2$1(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*preflightError*/ ctx[2]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*preflightFileFail*/ 2) show_if = Object.keys(/*preflightFileFail*/ ctx[1]).length !== 0;

    			if (show_if) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(if_block2_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function createWriteKey(templateKey, password, metaData) {
    	try {
    		let res = await fetch("https://exius.nrdlab.org/WriteKey/createWriteKey", {
    			headers: {
    				"Content-Type": "application/json",
    				authorization: `templateKey:${templateKey};password:${password}`
    			},
    			method: "POST",
    			body: JSON.stringify({ metaData })
    		});

    		return await res.json();
    	} catch(e) {
    		throw e;
    	}
    }

    async function Send_Data_To_Exius(params, templateKey, writeKey) {
    	// [{endpoint:Horizon_CSV,data:data,fname:fname}]
    	try {
    		var fd = new FormData();

    		for (const fileInfo of params) {
    			//console.log(fileInfo)
    			let URL = new Blob([fileInfo.data], { type: "text/csv;charset=utf-8;" });

    			fd.append(fileInfo.endpoint, URL, fileInfo.fname);
    		}

    		let res = await fetch("https://exius.nrdlab.org/Upload", {
    			headers: {
    				authorization: `templateKey:${templateKey};writeKey:${writeKey}`
    			},
    			method: "POST",
    			body: fd
    		});

    		return await res.json();
    	} catch(e) {
    		throw e;
    	}
    }

    function getQuery() {
    	return Object.fromEntries([...new URLSearchParams(window.location.search)]);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Password", slots, []);
    	let { writeKeyPass } = $$props;
    	let preflightInitiated = false;
    	let preflightFileFail = {};
    	let preflightError = false;
    	let queryNotFound = false;

    	async function submitPreflight(id, password) {
    		try {
    			$$invalidate(0, preflightInitiated = true);
    			let writeKey = await createWriteKey("Teacher_Task", password, "test_data");

    			let dataPreflight = await Send_Data_To_Exius(
    				[
    					{
    						endpoint: "TeacherCSV",
    						fname: `Subject_${id}.csv`,
    						data: ""
    					},
    					{
    						endpoint: "TeacherResponse",
    						fname: `Response_${id}.txt`,
    						data: ""
    					}
    				],
    				"Teacher_Task",
    				writeKey.writeKey
    			);

    			//console.log(writeKey.writeKey)
    			console.log(dataPreflight);

    			if (Object.keys(dataPreflight.failedFiles).length == 0) {
    				writeKeyPass(writeKey.writeKey, id);
    			} else {
    				$$invalidate(1, preflightFileFail = dataPreflight);
    			}
    		} catch(e) {
    			console.log(e);
    			$$invalidate(2, preflightError = true);
    		}
    	}

    	let queryData = getQuery();
    	submitPreflight(queryData.id ? queryData.id : 1234, queryData.pwd);
    	const writable_props = ["writeKeyPass"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Password> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("writeKeyPass" in $$props) $$invalidate(3, writeKeyPass = $$props.writeKeyPass);
    	};

    	$$self.$capture_state = () => ({
    		writeKeyPass,
    		preflightInitiated,
    		preflightFileFail,
    		preflightError,
    		queryNotFound,
    		createWriteKey,
    		Send_Data_To_Exius,
    		submitPreflight,
    		getQuery,
    		queryData
    	});

    	$$self.$inject_state = $$props => {
    		if ("writeKeyPass" in $$props) $$invalidate(3, writeKeyPass = $$props.writeKeyPass);
    		if ("preflightInitiated" in $$props) $$invalidate(0, preflightInitiated = $$props.preflightInitiated);
    		if ("preflightFileFail" in $$props) $$invalidate(1, preflightFileFail = $$props.preflightFileFail);
    		if ("preflightError" in $$props) $$invalidate(2, preflightError = $$props.preflightError);
    		if ("queryNotFound" in $$props) queryNotFound = $$props.queryNotFound;
    		if ("queryData" in $$props) queryData = $$props.queryData;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [preflightInitiated, preflightFileFail, preflightError, writeKeyPass];
    }

    class Password extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { writeKeyPass: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Password",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*writeKeyPass*/ ctx[3] === undefined && !("writeKeyPass" in props)) {
    			console_1$1.warn("<Password> was created without expected prop 'writeKeyPass'");
    		}
    	}

    	get writeKeyPass() {
    		throw new Error("<Password>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set writeKeyPass(value) {
    		throw new Error("<Password>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Control.svelte generated by Svelte v3.34.0 */

    const { console: console_1 } = globals;

    // (29:0) {#if !passedKey}
    function create_if_block_3(ctx) {
    	let password;
    	let current;

    	password = new Password({
    			props: { writeKeyPass: /*getWriteKey*/ ctx[9] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(password.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(password, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(password.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(password.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(password, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(29:0) {#if !passedKey}",
    		ctx
    	});

    	return block;
    }

    // (32:0) {#if passedKey && instructionsDone===false}
    function create_if_block_2(ctx) {
    	let instructions;
    	let current;

    	instructions = new Instructions({
    			props: {
    				toGame: /*toGame*/ ctx[6],
    				getData: /*getData*/ ctx[8],
    				writeKey: /*writeKey*/ ctx[3],
    				id: /*id*/ ctx[4]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(instructions.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(instructions, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const instructions_changes = {};
    			if (dirty & /*writeKey*/ 8) instructions_changes.writeKey = /*writeKey*/ ctx[3];
    			if (dirty & /*id*/ 16) instructions_changes.id = /*id*/ ctx[4];
    			instructions.$set(instructions_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(instructions.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(instructions.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(instructions, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(32:0) {#if passedKey && instructionsDone===false}",
    		ctx
    	});

    	return block;
    }

    // (35:0) {#if (instructionsDone && !gameEnd)}
    function create_if_block_1(ctx) {
    	let game;
    	let current;

    	game = new Game({
    			props: {
    				toDebrief: /*toDebrief*/ ctx[7],
    				gameString: /*gameData*/ ctx[5],
    				writeKey: /*writeKey*/ ctx[3],
    				id: /*id*/ ctx[4]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(game.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(game, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const game_changes = {};
    			if (dirty & /*gameData*/ 32) game_changes.gameString = /*gameData*/ ctx[5];
    			if (dirty & /*writeKey*/ 8) game_changes.writeKey = /*writeKey*/ ctx[3];
    			if (dirty & /*id*/ 16) game_changes.id = /*id*/ ctx[4];
    			game.$set(game_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(game, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(35:0) {#if (instructionsDone && !gameEnd)}",
    		ctx
    	});

    	return block;
    }

    // (38:0) {#if gameEnd}
    function create_if_block(ctx) {
    	let redirect;
    	let current;
    	redirect = new Redirect({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(redirect.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redirect, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(redirect.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(redirect.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(redirect, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(38:0) {#if gameEnd}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let if_block3_anchor;
    	let current;
    	let if_block0 = !/*passedKey*/ ctx[2] && create_if_block_3(ctx);
    	let if_block1 = /*passedKey*/ ctx[2] && /*instructionsDone*/ ctx[0] === false && create_if_block_2(ctx);
    	let if_block2 = /*instructionsDone*/ ctx[0] && !/*gameEnd*/ ctx[1] && create_if_block_1(ctx);
    	let if_block3 = /*gameEnd*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			if_block3_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev(target, if_block3_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*passedKey*/ ctx[2]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*passedKey*/ 4) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*passedKey*/ ctx[2] && /*instructionsDone*/ ctx[0] === false) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*passedKey, instructionsDone*/ 5) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*instructionsDone*/ ctx[0] && !/*gameEnd*/ ctx[1]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*instructionsDone, gameEnd*/ 3) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(t2.parentNode, t2);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*gameEnd*/ ctx[1]) {
    				if (if_block3) {
    					if (dirty & /*gameEnd*/ 2) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(if_block3_anchor.parentNode, if_block3_anchor);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev(if_block3_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Control", slots, []);
    	let instructionsDone = false;
    	let gameEnd = false;
    	let passedKey = false;
    	let writeKey = undefined;
    	let id = undefined;
    	let gameData = "";

    	function toGame() {
    		$$invalidate(0, instructionsDone = true);
    	}

    	function toDebrief() {
    		$$invalidate(1, gameEnd = true);
    	}

    	function getData(data) {
    		$$invalidate(5, gameData = data);
    		console.log(data);
    	}

    	function getWriteKey(writeKey_d, id_d) {
    		$$invalidate(2, passedKey = true);
    		$$invalidate(4, id = id_d);
    		$$invalidate(3, writeKey = writeKey_d);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Control> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Game,
    		Instructions,
    		Redirect,
    		Password,
    		instructionsDone,
    		gameEnd,
    		passedKey,
    		writeKey,
    		id,
    		gameData,
    		toGame,
    		toDebrief,
    		getData,
    		getWriteKey
    	});

    	$$self.$inject_state = $$props => {
    		if ("instructionsDone" in $$props) $$invalidate(0, instructionsDone = $$props.instructionsDone);
    		if ("gameEnd" in $$props) $$invalidate(1, gameEnd = $$props.gameEnd);
    		if ("passedKey" in $$props) $$invalidate(2, passedKey = $$props.passedKey);
    		if ("writeKey" in $$props) $$invalidate(3, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(4, id = $$props.id);
    		if ("gameData" in $$props) $$invalidate(5, gameData = $$props.gameData);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		instructionsDone,
    		gameEnd,
    		passedKey,
    		writeKey,
    		id,
    		gameData,
    		toGame,
    		toDebrief,
    		getData,
    		getWriteKey
    	];
    }

    class Control extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Control",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new Control({
    	target: document.body,
    	props: {
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
