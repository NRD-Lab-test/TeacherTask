
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

    const file$b = "src/RedGreen.svelte";

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

    // (49:8) {#each rangeGreen as i}
    function create_each_block_1(ctx) {
    	let div;
    	let div_style_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "greenDot svelte-1iyuq8d");
    			attr_dev(div, "style", div_style_value = "left:calc(" + 2 * Math.floor(/*i*/ ctx[10] / /*stackSize*/ ctx[2]) + " * min(2vh,2vw));); top: calc(" + 2 * (/*stackSize*/ ctx[2] - /*i*/ ctx[10] % /*stackSize*/ ctx[2]) + " * min(2vh,2vw) + min(7vh,7vw)); position:absolute;");
    			add_location(div, file$b, 49, 12, 1300);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rangeGreen*/ 1 && div_style_value !== (div_style_value = "left:calc(" + 2 * Math.floor(/*i*/ ctx[10] / /*stackSize*/ ctx[2]) + " * min(2vh,2vw));); top: calc(" + 2 * (/*stackSize*/ ctx[2] - /*i*/ ctx[10] % /*stackSize*/ ctx[2]) + " * min(2vh,2vw) + min(7vh,7vw)); position:absolute;")) {
    				attr_dev(div, "style", div_style_value);
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
    		source: "(49:8) {#each rangeGreen as i}",
    		ctx
    	});

    	return block;
    }

    // (58:8) {#each rangeRed as j}
    function create_each_block$3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "redDot svelte-1iyuq8d");
    			set_style(div, "left", "calc(" + 2 * Math.floor(/*j*/ ctx[7] / /*stackSize*/ ctx[2]) + " * min(2vh,2vw))");
    			set_style(div, "top", "calc(" + 2 * (/*stackSize*/ ctx[2] - /*j*/ ctx[7] % /*stackSize*/ ctx[2]) + " * min(2vh,2vw) + min(7vh,7vw))");
    			set_style(div, "position", "absolute");
    			add_location(div, file$b, 58, 12, 1856);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*rangeRed*/ 2) {
    				set_style(div, "left", "calc(" + 2 * Math.floor(/*j*/ ctx[7] / /*stackSize*/ ctx[2]) + " * min(2vh,2vw))");
    			}

    			if (dirty & /*rangeRed*/ 2) {
    				set_style(div, "top", "calc(" + 2 * (/*stackSize*/ ctx[2] - /*j*/ ctx[7] % /*stackSize*/ ctx[2]) + " * min(2vh,2vw) + min(7vh,7vw))");
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
    		source: "(58:8) {#each rangeRed as j}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
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
    			h0.textContent = "Green Lights";
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
    			h1.textContent = "Red Lights";
    			t5 = space();
    			div3 = element("div");
    			t6 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			set_style(h0, "color", "black");
    			set_style(h0, "position", "absolute");
    			set_style(h0, "width", "min(20vh,20vw)");
    			set_style(h0, "left", "max(-2vw,-2vh)");
    			set_style(h0, "font-size", "min(2vh,2vw)");
    			set_style(h0, "text-align", "center");
    			set_style(h0, "top", "min(2vh,2vw)");
    			add_location(h0, file$b, 46, 8, 1045);
    			attr_dev(div0, "class", "ballContainer svelte-1iyuq8d");
    			add_location(div0, file$b, 47, 8, 1220);
    			attr_dev(div1, "class", "dotContainer svelte-1iyuq8d");
    			set_style(div1, "left", "min(2vw,2vh)");
    			add_location(div1, file$b, 45, 4, 981);
    			add_location(div2, file$b, 44, 4, 971);
    			set_style(h1, "color", "black");
    			set_style(h1, "position", "absolute");
    			set_style(h1, "width", "min(20vh,20vw)");
    			set_style(h1, "left", "max(-2vw,-2vh)");
    			set_style(h1, "font-size", "min(2vh,2vw)");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "top", "min(2vh,2vw)");
    			add_location(h1, file$b, 55, 8, 1607);
    			attr_dev(div3, "class", "ballContainer svelte-1iyuq8d");
    			add_location(div3, file$b, 56, 8, 1780);
    			attr_dev(div4, "class", "dotContainer svelte-1iyuq8d");
    			set_style(div4, "left", "min(21.5vw,21.5vh)");
    			add_location(div4, file$b, 54, 4, 1540);
    			add_location(div5, file$b, 53, 4, 1530);
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
    			if (dirty & /*Math, rangeGreen, stackSize*/ 5) {
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

    			if (dirty & /*Math, rangeRed, stackSize*/ 6) {
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
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
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
    		if ("numberGreen" in $$props) $$invalidate(3, numberGreen = $$props.numberGreen);
    		if ("clearBoard" in $$props) $$invalidate(4, clearBoard = $$props.clearBoard);
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
    		if ("numberGreen" in $$props) $$invalidate(3, numberGreen = $$props.numberGreen);
    		if ("clearBoard" in $$props) $$invalidate(4, clearBoard = $$props.clearBoard);
    		if ("stackSize" in $$props) $$invalidate(2, stackSize = $$props.stackSize);
    		if ("ballSize" in $$props) ballSize = $$props.ballSize;
    		if ("numberRed" in $$props) $$invalidate(5, numberRed = $$props.numberRed);
    		if ("rangeGreen" in $$props) $$invalidate(0, rangeGreen = $$props.rangeGreen);
    		if ("rangeRed" in $$props) $$invalidate(1, rangeRed = $$props.rangeRed);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*clearBoard, numberGreen*/ 24) {
    			$$invalidate(5, numberRed = !clearBoard ? 20 - numberGreen : 0);
    		}

    		if ($$self.$$.dirty & /*numberGreen*/ 8) {
    			$$invalidate(0, rangeGreen = [...Array(numberGreen).keys()]);
    		}

    		if ($$self.$$.dirty & /*numberRed*/ 32) {
    			$$invalidate(1, rangeRed = [...Array(numberRed).keys()]);
    		}
    	};

    	return [rangeGreen, rangeRed, stackSize, numberGreen, clearBoard, numberRed];
    }

    class RedGreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { numberGreen: 3, clearBoard: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RedGreen",
    			options,
    			id: create_fragment$e.name
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

    const { console: console_1$5 } = globals;
    const file$a = "src/Game.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[35] = list[i];
    	return child_ctx;
    }

    // (410:0) {#key trial}
    function create_key_block_5(ctx) {
    	let h10;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let h11;
    	let t5;
    	let t6;
    	let t7;
    	let t8;

    	const block_1 = {
    		c: function create() {
    			h10 = element("h1");
    			t0 = text("Day ");
    			t1 = text(/*trial*/ ctx[4]);
    			t2 = text(" of ");
    			t3 = text(/*numTrials*/ ctx[1]);
    			t4 = space();
    			h11 = element("h1");
    			t5 = text("Month ");
    			t6 = text(/*block*/ ctx[2]);
    			t7 = text(" of ");
    			t8 = text(/*totalBlocks*/ ctx[3]);
    			attr_dev(h10, "class", "points svelte-1mam9b6");
    			add_location(h10, file$a, 410, 4, 12411);
    			attr_dev(h11, "class", "points svelte-1mam9b6");
    			set_style(h11, "left", "calc(50vw - min(50vw, 50vh))");
    			add_location(h11, file$a, 411, 4, 12467);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			append_dev(h10, t0);
    			append_dev(h10, t1);
    			append_dev(h10, t2);
    			append_dev(h10, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, h11, anchor);
    			append_dev(h11, t5);
    			append_dev(h11, t6);
    			append_dev(h11, t7);
    			append_dev(h11, t8);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*trial*/ 16) set_data_dev(t1, /*trial*/ ctx[4]);
    			if (dirty[0] & /*numTrials*/ 2) set_data_dev(t3, /*numTrials*/ ctx[1]);
    			if (dirty[0] & /*block*/ 4) set_data_dev(t6, /*block*/ ctx[2]);
    			if (dirty[0] & /*totalBlocks*/ 8) set_data_dev(t8, /*totalBlocks*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(h11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_key_block_5.name,
    		type: "key",
    		source: "(410:0) {#key trial}",
    		ctx
    	});

    	return block_1;
    }

    // (419:8) {#key lastGreenBar}
    function create_key_block_4(ctx) {
    	let div;

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "progressLeft svelte-1mam9b6");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*lastGreenBar*/ ctx[13] + ")");
    			set_style(div, "left", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenBar*/ ctx[15] + ")");
    			set_style(div, "position", "absolute");
    			add_location(div, file$a, 419, 12, 12979);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*numTrials, lastGreenBar*/ 8194) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*lastGreenBar*/ ctx[13] + ")");
    			}

    			if (dirty[0] & /*numTrials, greenBar*/ 32770) {
    				set_style(div, "left", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenBar*/ ctx[15] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_key_block_4.name,
    		type: "key",
    		source: "(419:8) {#key lastGreenBar}",
    		ctx
    	});

    	return block_1;
    }

    // (417:4) {#key greenBar}
    function create_key_block_3$1(ctx) {
    	let div;
    	let t;
    	let previous_key = /*lastGreenBar*/ ctx[13];
    	let key_block_anchor;
    	let key_block = create_key_block_4(ctx);

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			key_block.c();
    			key_block_anchor = empty();
    			attr_dev(div, "class", "progressGreen svelte-1mam9b6");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenBar*/ ctx[15] + ")");
    			set_style(div, "position", "absolute");
    			add_location(div, file$a, 417, 8, 12819);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*numTrials, greenBar*/ 32770) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenBar*/ ctx[15] + ")");
    			}

    			if (dirty[0] & /*lastGreenBar*/ 8192 && safe_not_equal(previous_key, previous_key = /*lastGreenBar*/ ctx[13])) {
    				key_block.d(1);
    				key_block = create_key_block_4(ctx);
    				key_block.c();
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_key_block_3$1.name,
    		type: "key",
    		source: "(417:4) {#key greenBar}",
    		ctx
    	});

    	return block_1;
    }

    // (425:8) {#key lastRedBar}
    function create_key_block_2$2(ctx) {
    	let div;

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "progressRight svelte-1mam9b6");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*lastRedBar*/ ctx[14] + ")");
    			set_style(div, "left", "calc(min(60vh,60vw) - ((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redBar*/ ctx[16] + ") + 1px)");
    			set_style(div, "position", "absolute");
    			add_location(div, file$a, 425, 12, 13390);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*numTrials, lastRedBar*/ 16386) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*lastRedBar*/ ctx[14] + ")");
    			}

    			if (dirty[0] & /*numTrials, redBar*/ 65538) {
    				set_style(div, "left", "calc(min(60vh,60vw) - ((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redBar*/ ctx[16] + ") + 1px)");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_key_block_2$2.name,
    		type: "key",
    		source: "(425:8) {#key lastRedBar}",
    		ctx
    	});

    	return block_1;
    }

    // (423:4) {#key redBar}
    function create_key_block_1$3(ctx) {
    	let div;
    	let t;
    	let previous_key = /*lastRedBar*/ ctx[14];
    	let key_block_anchor;
    	let key_block = create_key_block_2$2(ctx);

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			key_block.c();
    			key_block_anchor = empty();
    			attr_dev(div, "class", "progressRed svelte-1mam9b6");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redBar*/ ctx[16] + ")");
    			set_style(div, "left", "min(60vh,60vw)");
    			set_style(div, "position", "absolute");
    			add_location(div, file$a, 423, 8, 13215);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*numTrials, redBar*/ 65538) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redBar*/ ctx[16] + ")");
    			}

    			if (dirty[0] & /*lastRedBar*/ 16384 && safe_not_equal(previous_key, previous_key = /*lastRedBar*/ ctx[14])) {
    				key_block.d(1);
    				key_block = create_key_block_2$2(ctx);
    				key_block.c();
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_key_block_1$3.name,
    		type: "key",
    		source: "(423:4) {#key redBar}",
    		ctx
    	});

    	return block_1;
    }

    // (432:8) {#if counter<numTrials+1}
    function create_if_block$9(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$8, create_else_block_1$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[35] == 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block_1 = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
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
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(432:8) {#if counter<numTrials+1}",
    		ctx
    	});

    	return block_1;
    }

    // (452:16) {:else}
    function create_else_block_1$2(ctx) {
    	let div3;
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
    	let t4;
    	let current;
    	const if_block_creators = [create_if_block_5$4, create_else_block_2$2];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*viewExplore*/ ctx[5]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[11] && create_if_block_4$5(ctx);

    	const block_1 = {
    		c: function create() {
    			div3 = element("div");
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
    			t4 = space();
    			attr_dev(h1, "class", "teachingMoves svelte-1mam9b6");
    			add_location(h1, file$a, 453, 16, 14933);
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$a, 455, 20, 15174);
    			attr_dev(div1, "class", "greyBox svelte-1mam9b6");
    			attr_dev(div1, "id", div1_id_value = `box2: ${/*counter*/ ctx[0]}`);
    			add_location(div1, file$a, 454, 16, 14998);
    			attr_dev(div2, "class", "blueLight svelte-1mam9b6");
    			set_style(div2, "opacity", !/*exploreSelect*/ ctx[8] ? "0" : "1");
    			add_location(div2, file$a, 463, 17, 15623);
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "calc(50vw + min(5vw, 5vh))");
    			set_style(div3, "top", "min(30vh,30vw)");
    			add_location(div3, file$a, 452, 16, 14830);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div3, t3);
    			if (if_block1) if_block1.m(div3, null);
    			append_dev(div3, t4);
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

    			if (!current || dirty[0] & /*exploreSelect*/ 256) {
    				set_style(div2, "opacity", !/*exploreSelect*/ ctx[8] ? "0" : "1");
    			}

    			if (/*keyView*/ ctx[11]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_4$5(ctx);
    					if_block1.c();
    					if_block1.m(div3, t4);
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

    				if (!div1_intro) div1_intro = create_in_transition(div1, /*migrateLeftExplore*/ ctx[18], {
    					replaceExploit: /*replaceExploit*/ ctx[10]
    				});

    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div1_intro) div1_intro.invalidate();

    			div1_outro = create_out_transition(div1, /*InvisibleOrDown*/ ctx[21], {
    				replaceExploit: /*replaceExploit*/ ctx[10]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div1_outro) div1_outro.end();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(452:16) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (433:12) {#if i==0}
    function create_if_block_1$8(ctx) {
    	let div3;
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
    	let t4;
    	let current;
    	const if_block_creators = [create_if_block_3$6, create_else_block$6];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*clearBoard*/ ctx[12]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[11] && create_if_block_2$8(ctx);

    	const block_1 = {
    		c: function create() {
    			div3 = element("div");
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
    			t4 = space();
    			attr_dev(h1, "class", "teachingMoves svelte-1mam9b6");
    			add_location(h1, file$a, 434, 20, 13849);
    			attr_dev(div0, "class", "blueLight svelte-1mam9b6");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[9] ? "0" : "1");
    			add_location(div0, file$a, 435, 20, 13922);
    			set_style(div1, "top", "0px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$a, 437, 24, 14196);
    			attr_dev(div2, "class", "greyBox svelte-1mam9b6");
    			attr_dev(div2, "id", div2_id_value = `box1: ${/*counter*/ ctx[0]}`);
    			add_location(div2, file$a, 436, 20, 14019);
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "calc(50vw - min(45vw, 45vh))");
    			set_style(div3, "top", "min(30vh,30vw)");
    			add_location(div3, file$a, 433, 16, 13739);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, div0);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			append_dev(div3, t3);
    			if (if_block1) if_block1.m(div3, null);
    			append_dev(div3, t4);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty[0] & /*exploitSelect*/ 512) {
    				set_style(div0, "opacity", !/*exploitSelect*/ ctx[9] ? "0" : "1");
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

    			if (/*keyView*/ ctx[11]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_2$8(ctx);
    					if_block1.c();
    					if_block1.m(div3, t4);
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

    				if (!div2_intro) div2_intro = create_in_transition(div2, /*migrateLeftExploit*/ ctx[19], {
    					replaceExploit: /*replaceExploit*/ ctx[10]
    				});

    				div2_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div2_intro) div2_intro.invalidate();

    			div2_outro = create_out_transition(div2, /*migrateOut*/ ctx[20], {
    				replaceExploit: /*replaceExploit*/ ctx[10]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div2_outro) div2_outro.end();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_1$8.name,
    		type: "if",
    		source: "(433:12) {#if i==0}",
    		ctx
    	});

    	return block_1;
    }

    // (459:24) {:else}
    function create_else_block_2$2(ctx) {
    	let div;

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "?";
    			set_style(div, "width", "min(40vh,40vw)");
    			set_style(div, "height", "min(40vh,40vw)");
    			set_style(div, "text-align", "center");
    			set_style(div, "font-size", "min(20vh,20vw)");
    			set_style(div, "top", "min(5vh,5vw)");
    			set_style(div, "position", "absolute");
    			add_location(div, file$a, 459, 28, 15374);
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
    		block: block_1,
    		id: create_else_block_2$2.name,
    		type: "else",
    		source: "(459:24) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (457:24) {#if viewExplore}
    function create_if_block_5$4(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploreMu*/ ctx[7] },
    			$$inline: true
    		});

    	const block_1 = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploreMu*/ 128) redgreen_changes.numberGreen = /*exploreMu*/ ctx[7];
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
    		block: block_1,
    		id: create_if_block_5$4.name,
    		type: "if",
    		source: "(457:24) {#if viewExplore}",
    		ctx
    	});

    	return block_1;
    }

    // (465:12) {#if keyView}
    function create_if_block_4$5(ctx) {
    	let div;
    	let h2;

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Right Arrow";
    			attr_dev(h2, "class", "arrowKey svelte-1mam9b6");
    			add_location(h2, file$a, 466, 20, 15787);
    			attr_dev(div, "class", "arrowCover svelte-1mam9b6");
    			add_location(div, file$a, 465, 17, 15741);
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
    		block: block_1,
    		id: create_if_block_4$5.name,
    		type: "if",
    		source: "(465:12) {#if keyView}",
    		ctx
    	});

    	return block_1;
    }

    // (441:28) {:else}
    function create_else_block$6(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: 0, clearBoard: true },
    			$$inline: true
    		});

    	const block_1 = {
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
    		block: block_1,
    		id: create_else_block$6.name,
    		type: "else",
    		source: "(441:28) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (439:28) {#if !clearBoard}
    function create_if_block_3$6(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploitMu*/ ctx[6] },
    			$$inline: true
    		});

    	const block_1 = {
    		c: function create() {
    			create_component(redgreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(redgreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const redgreen_changes = {};
    			if (dirty[0] & /*exploitMu*/ 64) redgreen_changes.numberGreen = /*exploitMu*/ ctx[6];
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
    		block: block_1,
    		id: create_if_block_3$6.name,
    		type: "if",
    		source: "(439:28) {#if !clearBoard}",
    		ctx
    	});

    	return block_1;
    }

    // (446:20) {#if keyView}
    function create_if_block_2$8(ctx) {
    	let div;
    	let h2;

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Left Arrow";
    			attr_dev(h2, "class", "arrowKey svelte-1mam9b6");
    			add_location(h2, file$a, 447, 28, 14671);
    			attr_dev(div, "class", "arrowCover svelte-1mam9b6");
    			add_location(div, file$a, 446, 24, 14616);
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
    		block: block_1,
    		id: create_if_block_2$8.name,
    		type: "if",
    		source: "(446:20) {#if keyView}",
    		ctx
    	});

    	return block_1;
    }

    // (431:4) {#each range as i}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*counter*/ ctx[0] < /*numTrials*/ ctx[1] + 1 && create_if_block$9(ctx);

    	const block_1 = {
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
    			if (/*counter*/ ctx[0] < /*numTrials*/ ctx[1] + 1) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*counter, numTrials*/ 3) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$9(ctx);
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
    		block: block_1,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(431:4) {#each range as i}",
    		ctx
    	});

    	return block_1;
    }

    // (430:0) {#key counter}
    function create_key_block$4(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*range*/ ctx[17];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block_1 = {
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
    			if (dirty[0] & /*keyView, counter, replaceExploit, exploitMu, clearBoard, exploitSelect, range, exploreSelect, exploreMu, viewExplore, numTrials*/ 139235) {
    				each_value = /*range*/ ctx[17];
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
    		block: block_1,
    		id: create_key_block$4.name,
    		type: "key",
    		source: "(430:0) {#key counter}",
    		ctx
    	});

    	return block_1;
    }

    function create_fragment$d(ctx) {
    	let previous_key = /*trial*/ ctx[4];
    	let t0;
    	let h1;
    	let t2;
    	let div1;
    	let div0;
    	let t3;
    	let previous_key_1 = /*greenBar*/ ctx[15];
    	let t4;
    	let previous_key_2 = /*redBar*/ ctx[16];
    	let t5;
    	let previous_key_3 = /*counter*/ ctx[0];
    	let key_block3_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let key_block0 = create_key_block_5(ctx);
    	let key_block1 = create_key_block_3$1(ctx);
    	let key_block2 = create_key_block_1$3(ctx);
    	let key_block3 = create_key_block$4(ctx);

    	const block_1 = {
    		c: function create() {
    			key_block0.c();
    			t0 = space();
    			h1 = element("h1");
    			h1.textContent = "Total Student Understanding";
    			t2 = space();
    			div1 = element("div");
    			div0 = element("div");
    			t3 = space();
    			key_block1.c();
    			t4 = space();
    			key_block2.c();
    			t5 = space();
    			key_block3.c();
    			key_block3_anchor = empty();
    			attr_dev(h1, "class", "classUnderstanding svelte-1mam9b6");
    			add_location(h1, file$a, 413, 0, 12573);
    			attr_dev(div0, "class", "progressBar svelte-1mam9b6");
    			set_style(div0, "left", "max(-.5vw,-.5vh)");
    			add_location(div0, file$a, 415, 4, 12729);
    			set_style(div1, "left", "calc(50vw - min(30vh,30vw))");
    			set_style(div1, "top", "min(10vh,10vw)");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$a, 414, 0, 12637);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			key_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t3);
    			key_block1.m(div1, null);
    			append_dev(div1, t4);
    			key_block2.m(div1, null);
    			insert_dev(target, t5, anchor);
    			key_block3.m(target, anchor);
    			insert_dev(target, key_block3_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", /*handleKeydown*/ ctx[22], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*trial*/ 16 && safe_not_equal(previous_key, previous_key = /*trial*/ ctx[4])) {
    				key_block0.d(1);
    				key_block0 = create_key_block_5(ctx);
    				key_block0.c();
    				key_block0.m(t0.parentNode, t0);
    			} else {
    				key_block0.p(ctx, dirty);
    			}

    			if (dirty[0] & /*greenBar*/ 32768 && safe_not_equal(previous_key_1, previous_key_1 = /*greenBar*/ ctx[15])) {
    				key_block1.d(1);
    				key_block1 = create_key_block_3$1(ctx);
    				key_block1.c();
    				key_block1.m(div1, t4);
    			} else {
    				key_block1.p(ctx, dirty);
    			}

    			if (dirty[0] & /*redBar*/ 65536 && safe_not_equal(previous_key_2, previous_key_2 = /*redBar*/ ctx[16])) {
    				key_block2.d(1);
    				key_block2 = create_key_block_1$3(ctx);
    				key_block2.c();
    				key_block2.m(div1, null);
    			} else {
    				key_block2.p(ctx, dirty);
    			}

    			if (dirty[0] & /*counter*/ 1 && safe_not_equal(previous_key_3, previous_key_3 = /*counter*/ ctx[0])) {
    				group_outros();
    				transition_out(key_block3, 1, 1, noop);
    				check_outros();
    				key_block3 = create_key_block$4(ctx);
    				key_block3.c();
    				transition_in(key_block3);
    				key_block3.m(key_block3_anchor.parentNode, key_block3_anchor);
    			} else {
    				key_block3.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(key_block3);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(key_block3);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			key_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			key_block1.d(detaching);
    			key_block2.d(detaching);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(key_block3_anchor);
    			key_block3.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block_1;
    }

    async function timer$7(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    async function Send_Data_To_Exius$3(params, templateKey, writeKey) {
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

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Game", slots, []);
    	let { counter = 0 } = $$props;
    	const viewNumber = 2;
    	let { gameString = "" } = $$props;
    	let trialSd = 3;
    	let { numTrials = 30 } = $$props;
    	let trial = 1;
    	let range = [...Array(viewNumber).keys()];
    	let trialStartTime = Date.now();
    	let viewExplore = false;
    	let exploitMu = random_int$1();
    	let exploreMu = random_int$1();
    	let exploreSelect = false;
    	let exploitSelect = false;
    	let replaceExploit = { truth: false };
    	let keyView = true;
    	let clearBoard = false;
    	let currentUnderstanding = exploitMu;
    	let lastGreenBar = 0;
    	let lastRedBar = 0;
    	let greenBar = 0;
    	let redBar = 0;
    	let { toNext } = $$props;
    	let { writeKey } = $$props;
    	let { id } = $$props;
    	let { bothInvisible = true } = $$props;
    	let { block } = $$props;
    	let { totalBlocks } = $$props;
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
    				css: (t, u) => `transform: translateX(min(${50 * u}vw,${50 * u}vh)) `
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

    		if (trial == numTrials) {
    			$$invalidate(11, keyView = false);
    		}

    		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    			let singleTrialData = {
    				trial: trial.toString(),
    				previousExploit: exploitMu,
    				keyPressTime: Date.now(),
    				trialStartTime
    			};

    			$$invalidate(24, bothInvisible = false);
    			singleTrialData["Block"] = block;

    			if (event.key == "ArrowLeft") {
    				$$invalidate(15, greenBar += lastGreenBar);
    				$$invalidate(16, redBar += lastRedBar);
    				$$invalidate(13, lastGreenBar = 0);
    				$$invalidate(14, lastRedBar = 0);
    				$$invalidate(11, keyView = false);
    				let newDist = sample_normal_to_twenty();
    				singleTrialData["newExploit"] = newDist;
    				singleTrialData["choice"] = "exploit";
    				singleTrialData["exploreSeen"] = undefined;
    				$$invalidate(9, exploitSelect = true);
    				await timer$7(500);
    				$$invalidate(9, exploitSelect = false);
    				$$invalidate(12, clearBoard = true);
    				singleTrialData["exploitBoardClear"] = Date.now();
    				await timer$7(1000);
    				$$invalidate(6, exploitMu = newDist);
    				$$invalidate(13, lastGreenBar = newDist);
    				$$invalidate(14, lastRedBar = 20 - newDist);
    				$$invalidate(12, clearBoard = false);
    				$$invalidate(11, keyView = true);
    				singleTrialData["newExploitBoard"] = Date.now();
    				trialStartTime = Date.now();
    				currentUnderstanding = newDist;
    				$$invalidate(4, trial += 1);
    				console.log("done");
    			}

    			if (event.key == "ArrowRight") {
    				$$invalidate(5, viewExplore = true);
    				let newDist = random_int$1();
    				singleTrialData["choice"] = "explore";
    				singleTrialData["exploreSeen"] = newDist;
    				$$invalidate(15, greenBar += lastGreenBar);
    				$$invalidate(16, redBar += lastRedBar);
    				$$invalidate(13, lastGreenBar = 0);
    				$$invalidate(14, lastRedBar = 0);

    				if (newDist > exploitMu) {
    					singleTrialData["newExploit"] = newDist;
    					console.log("greater than");
    					$$invalidate(11, keyView = false);
    					$$invalidate(7, exploreMu = newDist);
    					$$invalidate(8, exploreSelect = true);
    					singleTrialData["newExploreVisible"] = Date.now();
    					await timer$7(500);
    					$$invalidate(8, exploreSelect = false);
    					singleTrialData["newExploreDeslected"] = Date.now();
    					await timer$7(500);
    					$$invalidate(6, exploitMu = newDist);
    					$$invalidate(5, viewExplore = false);
    					$$invalidate(10, replaceExploit.truth = true, replaceExploit);
    					$$invalidate(0, counter += 1);
    					singleTrialData["newExploreMove"] = Date.now();
    					await timer$7(500);
    					$$invalidate(13, lastGreenBar = newDist);
    					$$invalidate(14, lastRedBar = 20 - newDist);
    					$$invalidate(11, keyView = true);
    					singleTrialData["exploreFinishedMoving"] = Date.now();
    					trialStartTime = Date.now();
    					currentUnderstanding = newDist;
    					$$invalidate(4, trial += 1);
    				} else {
    					console.log("less than");
    					$$invalidate(11, keyView = false);
    					singleTrialData["newExploit"] = null;
    					$$invalidate(7, exploreMu = newDist);
    					$$invalidate(8, exploreSelect = true);
    					singleTrialData["newExploreVisible"] = Date.now();
    					await timer$7(500);
    					$$invalidate(8, exploreSelect = false);
    					singleTrialData["newExploreDeselected"] = Date.now();
    					await timer$7(500);
    					singleTrialData["newExploreMove"] = Date.now();
    					$$invalidate(5, viewExplore = false);
    					$$invalidate(10, replaceExploit.truth = false, replaceExploit);
    					$$invalidate(0, counter += 1);
    					await timer$7(500);
    					$$invalidate(13, lastGreenBar = newDist);
    					$$invalidate(14, lastRedBar = 20 - newDist);
    					$$invalidate(11, keyView = true);
    					singleTrialData["exploreFinishedMoving"] = Date.now();
    					trialStartTime = Date.now();
    					currentUnderstanding = newDist;
    					$$invalidate(4, trial += 1);
    				}
    			}

    			$$invalidate(24, bothInvisible = false);
    			export_data(singleTrialData);

    			if (trial === numTrials + 1) {
    				$$invalidate(11, keyView = false);
    				$$invalidate(24, bothInvisible = true);
    				await timer$7(300);
    				console.log(greenBar);
    				console.log(lastGreenBar);
    				toNext(gameString, greenBar + lastGreenBar);
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
    			"exploreFinishedMoving",
    			"Block"
    		];

    		let trialString = "";

    		for (const key of iterate_keys) {
    			trialString += `${data[key]},`;
    		}

    		$$invalidate(23, gameString += trialString.substring(0, trialString.length - 1) + "\n");

    		if (trial % 5 === 0) {
    			sendData();
    		}
    	}

    	async function sendData() {
    		console.log(await Send_Data_To_Exius$3(
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
    		"numTrials",
    		"toNext",
    		"writeKey",
    		"id",
    		"bothInvisible",
    		"block",
    		"totalBlocks"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$5.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("gameString" in $$props) $$invalidate(23, gameString = $$props.gameString);
    		if ("numTrials" in $$props) $$invalidate(1, numTrials = $$props.numTrials);
    		if ("toNext" in $$props) $$invalidate(26, toNext = $$props.toNext);
    		if ("writeKey" in $$props) $$invalidate(27, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(28, id = $$props.id);
    		if ("bothInvisible" in $$props) $$invalidate(24, bothInvisible = $$props.bothInvisible);
    		if ("block" in $$props) $$invalidate(2, block = $$props.block);
    		if ("totalBlocks" in $$props) $$invalidate(3, totalBlocks = $$props.totalBlocks);
    	};

    	$$self.$capture_state = () => ({
    		RedGreen,
    		counter,
    		viewNumber,
    		gameString,
    		trialSd,
    		numTrials,
    		trial,
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
    		lastGreenBar,
    		lastRedBar,
    		greenBar,
    		redBar,
    		toNext,
    		writeKey,
    		id,
    		bothInvisible,
    		block,
    		totalBlocks,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		timer: timer$7,
    		Send_Data_To_Exius: Send_Data_To_Exius$3,
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
    		if ("gameString" in $$props) $$invalidate(23, gameString = $$props.gameString);
    		if ("trialSd" in $$props) trialSd = $$props.trialSd;
    		if ("numTrials" in $$props) $$invalidate(1, numTrials = $$props.numTrials);
    		if ("trial" in $$props) $$invalidate(4, trial = $$props.trial);
    		if ("range" in $$props) $$invalidate(17, range = $$props.range);
    		if ("trialStartTime" in $$props) trialStartTime = $$props.trialStartTime;
    		if ("viewExplore" in $$props) $$invalidate(5, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(6, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(7, exploreMu = $$props.exploreMu);
    		if ("exploreSelect" in $$props) $$invalidate(8, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(9, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(10, replaceExploit = $$props.replaceExploit);
    		if ("keyView" in $$props) $$invalidate(11, keyView = $$props.keyView);
    		if ("clearBoard" in $$props) $$invalidate(12, clearBoard = $$props.clearBoard);
    		if ("currentUnderstanding" in $$props) currentUnderstanding = $$props.currentUnderstanding;
    		if ("lastGreenBar" in $$props) $$invalidate(13, lastGreenBar = $$props.lastGreenBar);
    		if ("lastRedBar" in $$props) $$invalidate(14, lastRedBar = $$props.lastRedBar);
    		if ("greenBar" in $$props) $$invalidate(15, greenBar = $$props.greenBar);
    		if ("redBar" in $$props) $$invalidate(16, redBar = $$props.redBar);
    		if ("toNext" in $$props) $$invalidate(26, toNext = $$props.toNext);
    		if ("writeKey" in $$props) $$invalidate(27, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(28, id = $$props.id);
    		if ("bothInvisible" in $$props) $$invalidate(24, bothInvisible = $$props.bothInvisible);
    		if ("block" in $$props) $$invalidate(2, block = $$props.block);
    		if ("totalBlocks" in $$props) $$invalidate(3, totalBlocks = $$props.totalBlocks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		counter,
    		numTrials,
    		block,
    		totalBlocks,
    		trial,
    		viewExplore,
    		exploitMu,
    		exploreMu,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		keyView,
    		clearBoard,
    		lastGreenBar,
    		lastRedBar,
    		greenBar,
    		redBar,
    		range,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		handleKeydown,
    		gameString,
    		bothInvisible,
    		viewNumber,
    		toNext,
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
    			instance$d,
    			create_fragment$d,
    			safe_not_equal,
    			{
    				counter: 0,
    				viewNumber: 25,
    				gameString: 23,
    				numTrials: 1,
    				toNext: 26,
    				writeKey: 27,
    				id: 28,
    				bothInvisible: 24,
    				block: 2,
    				totalBlocks: 3
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$d.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*toNext*/ ctx[26] === undefined && !("toNext" in props)) {
    			console_1$5.warn("<Game> was created without expected prop 'toNext'");
    		}

    		if (/*writeKey*/ ctx[27] === undefined && !("writeKey" in props)) {
    			console_1$5.warn("<Game> was created without expected prop 'writeKey'");
    		}

    		if (/*id*/ ctx[28] === undefined && !("id" in props)) {
    			console_1$5.warn("<Game> was created without expected prop 'id'");
    		}

    		if (/*block*/ ctx[2] === undefined && !("block" in props)) {
    			console_1$5.warn("<Game> was created without expected prop 'block'");
    		}

    		if (/*totalBlocks*/ ctx[3] === undefined && !("totalBlocks" in props)) {
    			console_1$5.warn("<Game> was created without expected prop 'totalBlocks'");
    		}
    	}

    	get counter() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set counter(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewNumber() {
    		return this.$$.ctx[25];
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

    	get numTrials() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set numTrials(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toNext() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toNext(value) {
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

    	get bothInvisible() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bothInvisible(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get block() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set block(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get totalBlocks() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set totalBlocks(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/NavigationButtons.svelte generated by Svelte v3.34.0 */

    const file$9 = "src/Instructions/NavigationButtons.svelte";

    // (29:0) {#if !breakTruth.truth && display}
    function create_if_block$8(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*nextInstruction*/ ctx[1] && /*previousInstruction*/ ctx[2]) return create_if_block_1$7;
    		if (/*nextInstruction*/ ctx[1]) return create_if_block_3$5;
    		return create_else_block$5;
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
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
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
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(29:0) {#if !breakTruth.truth && display}",
    		ctx
    	});

    	return block;
    }

    // (38:4) {:else}
    function create_else_block$5(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Back";
    			attr_dev(button, "class", "buttonCover svelte-1gvzfvl");
    			set_style(button, "left", "calc(50vw - min(10vh,10vw))");
    			add_location(button, file$9, 38, 8, 1434);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*previousInstruction*/ ctx[2](/*backSkip*/ ctx[4]))) /*previousInstruction*/ ctx[2](/*backSkip*/ ctx[4]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(38:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (36:30) 
    function create_if_block_3$5(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Next";
    			attr_dev(button, "class", "buttonCover svelte-1gvzfvl");
    			set_style(button, "left", "calc(50vw - min(10vh,10vw))");
    			add_location(button, file$9, 36, 8, 1287);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*nextInstruction*/ ctx[1](/*forwardSkip*/ ctx[5]))) /*nextInstruction*/ ctx[1](/*forwardSkip*/ ctx[5]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$5.name,
    		type: "if",
    		source: "(36:30) ",
    		ctx
    	});

    	return block;
    }

    // (30:4) {#if nextInstruction && previousInstruction}
    function create_if_block_1$7(ctx) {
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*replayAnimation*/ ctx[3] && create_if_block_2$7(ctx);

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "Back";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Next";
    			t3 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(button0, "class", "buttonCover svelte-1gvzfvl");
    			set_style(button0, "left", "calc(50vw - min(36vh,36vw))");
    			add_location(button0, file$9, 30, 8, 809);
    			attr_dev(button1, "class", "buttonCover svelte-1gvzfvl");
    			set_style(button1, "left", "calc(50vw + min(16vh,16vw))");
    			add_location(button1, file$9, 31, 8, 941);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t3, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*previousInstruction*/ ctx[2](/*backSkip*/ ctx[4]))) /*previousInstruction*/ ctx[2](/*backSkip*/ ctx[4]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						button1,
    						"click",
    						function () {
    							if (is_function(/*nextInstruction*/ ctx[1](/*forwardSkip*/ ctx[5]))) /*nextInstruction*/ ctx[1](/*forwardSkip*/ ctx[5]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*replayAnimation*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2$7(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t3);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$7.name,
    		type: "if",
    		source: "(30:4) {#if nextInstruction && previousInstruction}",
    		ctx
    	});

    	return block;
    }

    // (33:8) {#if replayAnimation}
    function create_if_block_2$7(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Replay Animation";
    			attr_dev(button, "class", "buttonCover svelte-1gvzfvl");
    			set_style(button, "left", "calc(50vw - min(10vh,10vw))");
    			add_location(button, file$9, 33, 12, 1108);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*replayAnimation*/ ctx[3]())) /*replayAnimation*/ ctx[3]().apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$7.name,
    		type: "if",
    		source: "(33:8) {#if replayAnimation}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let if_block_anchor;
    	let if_block = !/*breakTruth*/ ctx[0].truth && /*display*/ ctx[6] && create_if_block$8(ctx);

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
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*breakTruth*/ ctx[0].truth && /*display*/ ctx[6]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$8(ctx);
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
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("NavigationButtons", slots, []);
    	let { breakTruth = { truth: false } } = $$props;
    	let { nextInstruction = null } = $$props;
    	let { previousInstruction = null } = $$props;
    	let { replayAnimation = null } = $$props;
    	let { backSkip = 1 } = $$props;
    	let { forwardSkip = 1 } = $$props;
    	let { display = true } = $$props;

    	const writable_props = [
    		"breakTruth",
    		"nextInstruction",
    		"previousInstruction",
    		"replayAnimation",
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
    		if ("replayAnimation" in $$props) $$invalidate(3, replayAnimation = $$props.replayAnimation);
    		if ("backSkip" in $$props) $$invalidate(4, backSkip = $$props.backSkip);
    		if ("forwardSkip" in $$props) $$invalidate(5, forwardSkip = $$props.forwardSkip);
    		if ("display" in $$props) $$invalidate(6, display = $$props.display);
    	};

    	$$self.$capture_state = () => ({
    		breakTruth,
    		nextInstruction,
    		previousInstruction,
    		replayAnimation,
    		backSkip,
    		forwardSkip,
    		display
    	});

    	$$self.$inject_state = $$props => {
    		if ("breakTruth" in $$props) $$invalidate(0, breakTruth = $$props.breakTruth);
    		if ("nextInstruction" in $$props) $$invalidate(1, nextInstruction = $$props.nextInstruction);
    		if ("previousInstruction" in $$props) $$invalidate(2, previousInstruction = $$props.previousInstruction);
    		if ("replayAnimation" in $$props) $$invalidate(3, replayAnimation = $$props.replayAnimation);
    		if ("backSkip" in $$props) $$invalidate(4, backSkip = $$props.backSkip);
    		if ("forwardSkip" in $$props) $$invalidate(5, forwardSkip = $$props.forwardSkip);
    		if ("display" in $$props) $$invalidate(6, display = $$props.display);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		breakTruth,
    		nextInstruction,
    		previousInstruction,
    		replayAnimation,
    		backSkip,
    		forwardSkip,
    		display
    	];
    }

    class NavigationButtons extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			breakTruth: 0,
    			nextInstruction: 1,
    			previousInstruction: 2,
    			replayAnimation: 3,
    			backSkip: 4,
    			forwardSkip: 5,
    			display: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NavigationButtons",
    			options,
    			id: create_fragment$c.name
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

    	get replayAnimation() {
    		throw new Error("<NavigationButtons>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replayAnimation(value) {
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
    const file$8 = "src/Instructions/SingleChoice.svelte";

    // (55:12) {:else}
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
    		source: "(55:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (53:12) {#if !clearBoard}
    function create_if_block$7(ctx) {
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
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(53:12) {#if !clearBoard}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
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
    	const if_block_creators = [create_if_block$7, create_else_block$4];
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
    			attr_dev(h10, "class", "descriptionText svelte-4xysbd");
    			add_location(h10, file$8, 46, 0, 1158);
    			attr_dev(h11, "class", "teachingMoves svelte-4xysbd");
    			add_location(h11, file$8, 48, 4, 1298);
    			attr_dev(div0, "class", "blueLight svelte-4xysbd");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[3] ? "0" : "1");
    			add_location(div0, file$8, 49, 4, 1355);
    			set_style(div1, "top", "0px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$8, 51, 8, 1466);
    			attr_dev(div2, "class", "greyBox svelte-4xysbd");
    			add_location(div2, file$8, 50, 4, 1436);
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "calc(50vw - min(20vw, 20vh))");
    			set_style(div3, "top", "min(30vh,30vw)");
    			add_location(div3, file$8, 47, 0, 1204);
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
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
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

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			passedText: 0,
    			exploitMu: 1,
    			clearBoard: 2,
    			exploitSelect: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SingleChoice",
    			options,
    			id: create_fragment$b.name
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
    const file$7 = "src/Instructions/DoubleChoice.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	return child_ctx;
    }

    // (212:4) {#if pointCounter}
    function create_if_block_5$3(ctx) {
    	let h1;
    	let t0;
    	let t1_value = Math.round(/*points*/ ctx[9] / 20 * 100) + "";
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
    			add_location(h1, file$7, 212, 8, 5665);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*points*/ 512 && t1_value !== (t1_value = Math.round(/*points*/ ctx[9] / 20 * 100) + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5$3.name,
    		type: "if",
    		source: "(212:4) {#if pointCounter}",
    		ctx
    	});

    	return block;
    }

    // (235:12) {:else}
    function create_else_block_1$1(ctx) {
    	let div3;
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
    	let t4;
    	let current;
    	const if_block_creators = [create_if_block_4$4, create_else_block_2$1];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*viewExplore*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[10] && create_if_block_3$4(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
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
    			t4 = space();
    			attr_dev(h1, "class", "teachingMoves svelte-kkymw2");
    			add_location(h1, file$7, 236, 12, 7017);
    			set_style(div0, "top", "0px");
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$7, 238, 16, 7250);
    			attr_dev(div1, "class", "greyBox svelte-kkymw2");
    			attr_dev(div1, "id", div1_id_value = `box2: ${/*counter*/ ctx[0]}`);
    			add_location(div1, file$7, 237, 12, 7078);
    			attr_dev(div2, "class", "blueLight svelte-kkymw2");
    			set_style(div2, "opacity", !/*exploreSelect*/ ctx[3] ? "0" : "1");
    			add_location(div2, file$7, 246, 16, 7682);
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "calc(50vw + min(5vw, 5vh))");
    			set_style(div3, "top", "min(30vh,30vw)");
    			add_location(div3, file$7, 235, 12, 6918);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div3, t3);
    			if (if_block1) if_block1.m(div3, null);
    			append_dev(div3, t4);
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

    			if (!current || dirty[0] & /*exploreSelect*/ 8) {
    				set_style(div2, "opacity", !/*exploreSelect*/ ctx[3] ? "0" : "1");
    			}

    			if (/*keyView*/ ctx[10]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_3$4(ctx);
    					if_block1.c();
    					if_block1.m(div3, t4);
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

    				if (!div1_intro) div1_intro = create_in_transition(div1, /*migrateLeftExplore*/ ctx[12], {
    					replaceExploit: /*replaceExploit*/ ctx[5]
    				});

    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div1_intro) div1_intro.invalidate();

    			div1_outro = create_out_transition(div1, /*InvisibleOrDown*/ ctx[15], {
    				replaceExploit: /*replaceExploit*/ ctx[5]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div1_outro) div1_outro.end();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(235:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (216:8) {#if i==0}
    function create_if_block$6(ctx) {
    	let div3;
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
    	let t4;
    	let current;
    	const if_block_creators = [create_if_block_2$6, create_else_block$3];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*clearBoard*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[10] && create_if_block_1$6(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
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
    			t4 = space();
    			attr_dev(h1, "class", "teachingMoves svelte-kkymw2");
    			add_location(h1, file$7, 217, 12, 6033);
    			attr_dev(div0, "class", "blueLight svelte-kkymw2");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[4] ? "0" : "1");
    			add_location(div0, file$7, 218, 12, 6098);
    			set_style(div1, "top", "0px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$7, 220, 20, 6364);
    			attr_dev(div2, "class", "greyBox svelte-kkymw2");
    			attr_dev(div2, "id", div2_id_value = `box1: ${/*counter*/ ctx[0]}`);
    			add_location(div2, file$7, 219, 16, 6191);
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "calc(50vw - min(45vw, 45vh))");
    			set_style(div3, "top", "min(30vh,30vw)");
    			add_location(div3, file$7, 216, 12, 5931);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, div0);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			append_dev(div3, t3);
    			if (if_block1) if_block1.m(div3, null);
    			append_dev(div3, t4);
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

    			if (/*keyView*/ ctx[10]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1$6(ctx);
    					if_block1.c();
    					if_block1.m(div3, t4);
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

    				if (!div2_intro) div2_intro = create_in_transition(div2, /*migrateLeftExploit*/ ctx[13], {
    					replaceExploit: /*replaceExploit*/ ctx[5]
    				});

    				div2_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div2_intro) div2_intro.invalidate();

    			div2_outro = create_out_transition(div2, /*migrateOut*/ ctx[14], {
    				replaceExploit: /*replaceExploit*/ ctx[5]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div2_outro) div2_outro.end();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(216:8) {#if i==0}",
    		ctx
    	});

    	return block;
    }

    // (242:20) {:else}
    function create_else_block_2$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "?";
    			set_style(div, "width", "min(40vh,40vw)");
    			set_style(div, "height", "min(40vh,40vw)");
    			set_style(div, "text-align", "center");
    			set_style(div, "font-size", "min(20vh,20vw)");
    			set_style(div, "top", "min(5vh,5vw)");
    			set_style(div, "position", "absolute");
    			add_location(div, file$7, 242, 24, 7443);
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
    		source: "(242:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (240:20) {#if viewExplore}
    function create_if_block_4$4(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploreMu*/ ctx[7] },
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
    			if (dirty[0] & /*exploreMu*/ 128) redgreen_changes.numberGreen = /*exploreMu*/ ctx[7];
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
    		id: create_if_block_4$4.name,
    		type: "if",
    		source: "(240:20) {#if viewExplore}",
    		ctx
    	});

    	return block;
    }

    // (248:8) {#if keyView}
    function create_if_block_3$4(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Right Arrow";
    			attr_dev(h2, "class", "arrowKey svelte-kkymw2");
    			add_location(h2, file$7, 249, 16, 7837);
    			attr_dev(div, "class", "arrowCover svelte-kkymw2");
    			add_location(div, file$7, 248, 16, 7795);
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
    		id: create_if_block_3$4.name,
    		type: "if",
    		source: "(248:8) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (224:24) {:else}
    function create_else_block$3(ctx) {
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
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(224:24) {:else}",
    		ctx
    	});

    	return block;
    }

    // (222:24) {#if !clearBoard}
    function create_if_block_2$6(ctx) {
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
    		id: create_if_block_2$6.name,
    		type: "if",
    		source: "(222:24) {#if !clearBoard}",
    		ctx
    	});

    	return block;
    }

    // (229:12) {#if keyView}
    function create_if_block_1$6(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Left Arrow";
    			attr_dev(h2, "class", "arrowKey svelte-kkymw2");
    			add_location(h2, file$7, 230, 20, 6787);
    			attr_dev(div, "class", "arrowCover svelte-kkymw2");
    			add_location(div, file$7, 229, 16, 6740);
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
    		id: create_if_block_1$6.name,
    		type: "if",
    		source: "(229:12) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (215:4) {#each range as i}
    function create_each_block$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$6, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[30] == 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
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
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(215:4) {#each range as i}",
    		ctx
    	});

    	return block;
    }

    // (211:0) {#key counter}
    function create_key_block$3(ctx) {
    	let t;
    	let each_1_anchor;
    	let current;
    	let if_block = /*pointCounter*/ ctx[8] && create_if_block_5$3(ctx);
    	let each_value = /*range*/ ctx[11];
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
    			if (/*pointCounter*/ ctx[8]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_5$3(ctx);
    					if_block.c();
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*keyView, counter, replaceExploit, exploitMu, clearBoard, exploitSelect, range, exploreSelect, exploreMu, viewExplore*/ 3327) {
    				each_value = /*range*/ ctx[11];
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
    		id: create_key_block$3.name,
    		type: "key",
    		source: "(211:0) {#key counter}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let previous_key = /*counter*/ ctx[0];
    	let key_block_anchor;
    	let current;
    	let key_block = create_key_block$3(ctx);

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
    				key_block = create_key_block$3(ctx);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function timer$6(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("DoubleChoice", slots, []);
    	let { breakNav } = $$props;
    	let { counter = 0 } = $$props;
    	const viewNumber = 2;
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
    				css: (t, u) => `transform: translateX(min(${50 * u}vw,${50 * u}vh)) `
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
    		if (keyDisplay) $$invalidate(10, keyView = false);
    		breakNav(true);
    		await timer$6(delayTime);
    		$$invalidate(16, bothInvisible = { truth: false });
    		$$invalidate(1, viewExplore = true);
    		$$invalidate(3, exploreSelect = true);
    		await timer$6(500);
    		$$invalidate(3, exploreSelect = false);
    		await timer$6(1000);
    		$$invalidate(2, exploitMu = exploreMu);
    		$$invalidate(1, viewExplore = false);
    		$$invalidate(5, replaceExploit.truth = true, replaceExploit);
    		$$invalidate(0, counter += 1);
    		if (noReplaceExplore) invisibleExplore = true;
    		await timer$6(500);
    		breakNav(false);
    		if (keyDisplay) $$invalidate(10, keyView = true);
    		$$invalidate(16, bothInvisible = { truth: true });
    	}

    	async function delayedBadExplore() {
    		if (keyDisplay) $$invalidate(10, keyView = false);
    		breakNav(true);
    		await timer$6(delayTime);
    		$$invalidate(16, bothInvisible = { truth: false });
    		$$invalidate(1, viewExplore = true);
    		$$invalidate(3, exploreSelect = true);
    		await timer$6(500);
    		$$invalidate(3, exploreSelect = false);
    		await timer$6(1000);
    		$$invalidate(1, viewExplore = false);
    		$$invalidate(5, replaceExploit.truth = false, replaceExploit);
    		$$invalidate(0, counter += 1);
    		if (noReplaceExplore) invisibleExplore = true;
    		await timer$6(500);
    		breakNav(false);
    		if (keyDisplay) $$invalidate(10, keyView = true);
    		$$invalidate(16, bothInvisible = { truth: true });
    	}

    	async function delayedExploit() {
    		if (keyDisplay) $$invalidate(10, keyView = false);
    		breakNav(true);
    		await timer$6(delayTime);
    		$$invalidate(4, exploitSelect = true);
    		$$invalidate(16, bothInvisible = { truth: false });
    		await timer$6(500);
    		$$invalidate(6, clearBoard = true);
    		$$invalidate(4, exploitSelect = false);
    		await timer$6(1000);
    		$$invalidate(6, clearBoard = false);
    		$$invalidate(2, exploitMu = exploitMu2);
    		$$invalidate(0, counter += 1);
    		breakNav(false);
    		if (keyDisplay) $$invalidate(10, keyView = true);
    		$$invalidate(16, bothInvisible = { truth: true });
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
    		if ("breakNav" in $$props) $$invalidate(17, breakNav = $$props.breakNav);
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("delayGoodExplore" in $$props) $$invalidate(19, delayGoodExplore = $$props.delayGoodExplore);
    		if ("delayBadExplore" in $$props) $$invalidate(20, delayBadExplore = $$props.delayBadExplore);
    		if ("delayExploit" in $$props) $$invalidate(21, delayExploit = $$props.delayExploit);
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(7, exploreMu = $$props.exploreMu);
    		if ("exploitMu2" in $$props) $$invalidate(22, exploitMu2 = $$props.exploitMu2);
    		if ("exploreSelect" in $$props) $$invalidate(3, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(4, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(5, replaceExploit = $$props.replaceExploit);
    		if ("clearBoard" in $$props) $$invalidate(6, clearBoard = $$props.clearBoard);
    		if ("bothInvisible" in $$props) $$invalidate(16, bothInvisible = $$props.bothInvisible);
    		if ("keyDisplay" in $$props) $$invalidate(23, keyDisplay = $$props.keyDisplay);
    		if ("noReplaceExplore" in $$props) $$invalidate(24, noReplaceExplore = $$props.noReplaceExplore);
    		if ("pointCounter" in $$props) $$invalidate(8, pointCounter = $$props.pointCounter);
    		if ("points" in $$props) $$invalidate(9, points = $$props.points);
    		if ("delayTime" in $$props) $$invalidate(25, delayTime = $$props.delayTime);
    	};

    	$$self.$capture_state = () => ({
    		RedGreen,
    		breakNav,
    		counter,
    		viewNumber,
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
    		timer: timer$6,
    		delayedGoodExplore,
    		delayedBadExplore,
    		delayedExploit
    	});

    	$$self.$inject_state = $$props => {
    		if ("breakNav" in $$props) $$invalidate(17, breakNav = $$props.breakNav);
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("range" in $$props) $$invalidate(11, range = $$props.range);
    		if ("delayGoodExplore" in $$props) $$invalidate(19, delayGoodExplore = $$props.delayGoodExplore);
    		if ("delayBadExplore" in $$props) $$invalidate(20, delayBadExplore = $$props.delayBadExplore);
    		if ("delayExploit" in $$props) $$invalidate(21, delayExploit = $$props.delayExploit);
    		if ("viewExplore" in $$props) $$invalidate(1, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(2, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(7, exploreMu = $$props.exploreMu);
    		if ("exploitMu2" in $$props) $$invalidate(22, exploitMu2 = $$props.exploitMu2);
    		if ("exploreSelect" in $$props) $$invalidate(3, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(4, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(5, replaceExploit = $$props.replaceExploit);
    		if ("clearBoard" in $$props) $$invalidate(6, clearBoard = $$props.clearBoard);
    		if ("bothInvisible" in $$props) $$invalidate(16, bothInvisible = $$props.bothInvisible);
    		if ("keyDisplay" in $$props) $$invalidate(23, keyDisplay = $$props.keyDisplay);
    		if ("noReplaceExplore" in $$props) $$invalidate(24, noReplaceExplore = $$props.noReplaceExplore);
    		if ("pointCounter" in $$props) $$invalidate(8, pointCounter = $$props.pointCounter);
    		if ("points" in $$props) $$invalidate(9, points = $$props.points);
    		if ("delayTime" in $$props) $$invalidate(25, delayTime = $$props.delayTime);
    		if ("invisibleExplore" in $$props) invisibleExplore = $$props.invisibleExplore;
    		if ("keyView" in $$props) $$invalidate(10, keyView = $$props.keyView);
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
    		exploreMu,
    		pointCounter,
    		points,
    		keyView,
    		range,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		bothInvisible,
    		breakNav,
    		viewNumber,
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
    			instance$a,
    			create_fragment$a,
    			safe_not_equal,
    			{
    				breakNav: 17,
    				counter: 0,
    				viewNumber: 18,
    				delayGoodExplore: 19,
    				delayBadExplore: 20,
    				delayExploit: 21,
    				viewExplore: 1,
    				exploitMu: 2,
    				exploreMu: 7,
    				exploitMu2: 22,
    				exploreSelect: 3,
    				exploitSelect: 4,
    				replaceExploit: 5,
    				clearBoard: 6,
    				bothInvisible: 16,
    				keyDisplay: 23,
    				noReplaceExplore: 24,
    				pointCounter: 8,
    				points: 9,
    				delayTime: 25
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DoubleChoice",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*breakNav*/ ctx[17] === undefined && !("breakNav" in props)) {
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
    		return this.$$.ctx[18];
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

    const file$6 = "src/Instructions/FullScreen.svelte";

    function create_fragment$9(ctx) {
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
    			attr_dev(h1, "class", "bigText svelte-1r8zpd");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$6, 42, 0, 1084);
    			attr_dev(button, "class", "buttonCover svelte-1r8zpd");
    			add_location(button, file$6, 43, 0, 1181);
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
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function timer$5(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("FullScreen", slots, []);
    	let { nextInstruction } = $$props;

    	async function requestFullScreen() {
    		var elem = document.documentElement;
    		var requestMethod = elem.requestFullScreen || elem.webkitRequestFullScreen || elem.mozRequestFullScreen || elem.msRequestFullScreen;

    		if (requestMethod) {
    			requestMethod.call(elem);
    		}

    		await timer$5(100);
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
    		timer: timer$5,
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
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { nextInstruction: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FullScreen",
    			options,
    			id: create_fragment$9.name
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

    const { console: console_1$4 } = globals;
    const file$5 = "src/Instructions/PracticeGame.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[31] = list[i];
    	return child_ctx;
    }

    // (283:0) {#if !breakTruth.truth}
    function create_if_block$5(ctx) {
    	let previous_key = /*trial*/ ctx[3];
    	let t;
    	let previous_key_1 = /*counter*/ ctx[0];
    	let key_block1_anchor;
    	let current;
    	let key_block0 = create_key_block_1$2(ctx);
    	let key_block1 = create_key_block$2(ctx);

    	const block = {
    		c: function create() {
    			key_block0.c();
    			t = space();
    			key_block1.c();
    			key_block1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			key_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			key_block1.m(target, anchor);
    			insert_dev(target, key_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*trial*/ 8 && safe_not_equal(previous_key, previous_key = /*trial*/ ctx[3])) {
    				key_block0.d(1);
    				key_block0 = create_key_block_1$2(ctx);
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
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(283:0) {#if !breakTruth.truth}",
    		ctx
    	});

    	return block;
    }

    // (284:4) {#key trial}
    function create_key_block_1$2(ctx) {
    	let h1;
    	let t_value = /*trialDescriptions*/ ctx[1][/*trial*/ ctx[3] - 1] + "";
    	let t;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t = text(t_value);
    			attr_dev(h1, "class", "descriptionText svelte-5jds4h");
    			add_location(h1, file$5, 284, 8, 8444);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*trialDescriptions, trial*/ 10 && t_value !== (t_value = /*trialDescriptions*/ ctx[1][/*trial*/ ctx[3] - 1] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_1$2.name,
    		type: "key",
    		source: "(284:4) {#key trial}",
    		ctx
    	});

    	return block;
    }

    // (289:12) {#if counter<numTrials+1}
    function create_if_block_1$5(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2$5, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[31] == 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
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
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(289:12) {#if counter<numTrials+1}",
    		ctx
    	});

    	return block;
    }

    // (309:20) {:else}
    function create_else_block_1(ctx) {
    	let div3;
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
    	let t4;
    	let current;
    	const if_block_creators = [create_if_block_6$2, create_else_block_2];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*viewExplore*/ ctx[4]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[10] && create_if_block_5$2(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
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
    			t4 = space();
    			attr_dev(h1, "class", "teachingMoves svelte-5jds4h");
    			add_location(h1, file$5, 310, 20, 9921);
    			set_style(div0, "position", "absolute");
    			add_location(div0, file$5, 312, 28, 10178);
    			attr_dev(div1, "class", "greyBox svelte-5jds4h");
    			attr_dev(div1, "id", div1_id_value = `box2: ${/*counter*/ ctx[0]}`);
    			add_location(div1, file$5, 311, 24, 9994);
    			attr_dev(div2, "class", "blueLight svelte-5jds4h");
    			set_style(div2, "opacity", !/*exploreSelect*/ ctx[7] ? "0" : "1");
    			add_location(div2, file$5, 320, 20, 10685);
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "calc(50vw + min(5vw, 5vh))");
    			set_style(div3, "top", "min(30vh,30vw)");
    			add_location(div3, file$5, 309, 20, 9815);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div3, t3);
    			if (if_block1) if_block1.m(div3, null);
    			append_dev(div3, t4);
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

    			if (!current || dirty[0] & /*exploreSelect*/ 128) {
    				set_style(div2, "opacity", !/*exploreSelect*/ ctx[7] ? "0" : "1");
    			}

    			if (/*keyView*/ ctx[10]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_5$2(ctx);
    					if_block1.c();
    					if_block1.m(div3, t4);
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

    				if (!div1_intro) div1_intro = create_in_transition(div1, /*migrateLeftExplore*/ ctx[14], {
    					replaceExploit: /*replaceExploit*/ ctx[9]
    				});

    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div1_intro) div1_intro.invalidate();

    			div1_outro = create_out_transition(div1, /*InvisibleOrDown*/ ctx[17], {
    				replaceExploit: /*replaceExploit*/ ctx[9]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div1_outro) div1_outro.end();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(309:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (290:16) {#if i==0}
    function create_if_block_2$5(ctx) {
    	let div3;
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
    	let t4;
    	let current;
    	const if_block_creators = [create_if_block_4$3, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*clearBoard*/ ctx[11]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*keyView*/ ctx[10] && create_if_block_3$3(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
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
    			t4 = space();
    			attr_dev(h1, "class", "teachingMoves svelte-5jds4h");
    			add_location(h1, file$5, 291, 24, 8762);
    			attr_dev(div0, "class", "blueLight svelte-5jds4h");
    			set_style(div0, "opacity", !/*exploitSelect*/ ctx[8] ? "0" : "1");
    			add_location(div0, file$5, 292, 24, 8839);
    			set_style(div1, "top", "0px");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$5, 294, 28, 9121);
    			attr_dev(div2, "class", "greyBox svelte-5jds4h");
    			attr_dev(div2, "id", div2_id_value = `box1: ${/*counter*/ ctx[0]}`);
    			add_location(div2, file$5, 293, 24, 8940);
    			set_style(div3, "position", "absolute");
    			set_style(div3, "left", "calc(50vw - min(45vw, 45vh))");
    			set_style(div3, "top", "min(30vh,30vw)");
    			add_location(div3, file$5, 290, 20, 8648);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h1);
    			append_dev(div3, t1);
    			append_dev(div3, div0);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			append_dev(div3, t3);
    			if (if_block1) if_block1.m(div3, null);
    			append_dev(div3, t4);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty[0] & /*exploitSelect*/ 256) {
    				set_style(div0, "opacity", !/*exploitSelect*/ ctx[8] ? "0" : "1");
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

    			if (/*keyView*/ ctx[10]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_3$3(ctx);
    					if_block1.c();
    					if_block1.m(div3, t4);
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

    				if (!div2_intro) div2_intro = create_in_transition(div2, /*migrateLeftExploit*/ ctx[15], {
    					replaceExploit: /*replaceExploit*/ ctx[9]
    				});

    				div2_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			if (div2_intro) div2_intro.invalidate();

    			div2_outro = create_out_transition(div2, /*migrateOut*/ ctx[16], {
    				replaceExploit: /*replaceExploit*/ ctx[9]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_blocks[current_block_type_index].d();
    			if (detaching && div2_outro) div2_outro.end();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$5.name,
    		type: "if",
    		source: "(290:16) {#if i==0}",
    		ctx
    	});

    	return block;
    }

    // (316:32) {:else}
    function create_else_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "?";
    			set_style(div, "width", "min(40vh,40vw)");
    			set_style(div, "height", "min(40vh,40vw)");
    			set_style(div, "text-align", "center");
    			set_style(div, "font-size", "min(20vh,20vw)");
    			set_style(div, "top", "min(5vh,5vw)");
    			set_style(div, "position", "absolute");
    			add_location(div, file$5, 316, 36, 10410);
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
    		source: "(316:32) {:else}",
    		ctx
    	});

    	return block;
    }

    // (314:32) {#if viewExplore}
    function create_if_block_6$2(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploreMu*/ ctx[6] },
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
    			if (dirty[0] & /*exploreMu*/ 64) redgreen_changes.numberGreen = /*exploreMu*/ ctx[6];
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
    		id: create_if_block_6$2.name,
    		type: "if",
    		source: "(314:32) {#if viewExplore}",
    		ctx
    	});

    	return block;
    }

    // (322:16) {#if keyView}
    function create_if_block_5$2(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Right Arrow";
    			attr_dev(h2, "class", "arrowKey svelte-5jds4h");
    			add_location(h2, file$5, 323, 24, 10860);
    			attr_dev(div, "class", "arrowCover svelte-5jds4h");
    			add_location(div, file$5, 322, 20, 10810);
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
    		id: create_if_block_5$2.name,
    		type: "if",
    		source: "(322:16) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (298:32) {:else}
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
    		source: "(298:32) {:else}",
    		ctx
    	});

    	return block;
    }

    // (296:32) {#if !clearBoard}
    function create_if_block_4$3(ctx) {
    	let redgreen;
    	let current;

    	redgreen = new RedGreen({
    			props: { numberGreen: /*exploitMu*/ ctx[5] },
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
    			if (dirty[0] & /*exploitMu*/ 32) redgreen_changes.numberGreen = /*exploitMu*/ ctx[5];
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
    		id: create_if_block_4$3.name,
    		type: "if",
    		source: "(296:32) {#if !clearBoard}",
    		ctx
    	});

    	return block;
    }

    // (303:24) {#if keyView}
    function create_if_block_3$3(ctx) {
    	let div;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Left Arrow";
    			attr_dev(h2, "class", "arrowKey svelte-5jds4h");
    			add_location(h2, file$5, 304, 32, 9636);
    			attr_dev(div, "class", "arrowCover svelte-5jds4h");
    			add_location(div, file$5, 303, 28, 9577);
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
    		id: create_if_block_3$3.name,
    		type: "if",
    		source: "(303:24) {#if keyView}",
    		ctx
    	});

    	return block;
    }

    // (288:8) {#each range as i}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*counter*/ ctx[0] < /*numTrials*/ ctx[12] + 1 && create_if_block_1$5(ctx);

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
    			if (/*counter*/ ctx[0] < /*numTrials*/ ctx[12] + 1) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*counter*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_1$5(ctx);
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
    		source: "(288:8) {#each range as i}",
    		ctx
    	});

    	return block;
    }

    // (287:4) {#key counter}
    function create_key_block$2(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*range*/ ctx[13];
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
    			if (dirty[0] & /*keyView, counter, replaceExploit, exploitMu, clearBoard, exploitSelect, range, exploreSelect, exploreMu, viewExplore, numTrials*/ 16369) {
    				each_value = /*range*/ ctx[13];
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
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block$2.name,
    		type: "key",
    		source: "(287:4) {#key counter}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = !/*breakTruth*/ ctx[2].truth && create_if_block$5(ctx);

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
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", /*handleKeydown*/ ctx[18], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (!/*breakTruth*/ ctx[2].truth) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*breakTruth*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$5(ctx);
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

    async function timer$4(time) {
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

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("PracticeGame", slots, []);
    	let { counter = 0 } = $$props;
    	const viewNumber = 2;
    	let { gameString = "" } = $$props;
    	let trialSd = 3;
    	let numTrials = 4;
    	let trial = 1;
    	let range = [...Array(viewNumber).keys()];
    	let trialStartTime = Date.now();
    	let viewExplore = false;
    	let exploitMu = 15;
    	let exploreMu = random_int();
    	let exploreSelect = false;
    	let exploitSelect = false;
    	let replaceExploit = { truth: false };
    	let keyView = true;
    	let clearBoard = false;
    	let currentUnderstanding = exploitMu;
    	let lastGreenBar = 0;
    	let lastRedBar = 0;
    	let greenBar = 0;
    	let redBar = 0;
    	let { trialDescriptions = [] } = $$props;
    	let { toNext } = $$props;
    	let { bothInvisible = true } = $$props;
    	let { breakTruth = { truth: false } } = $$props;

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
    				css: (t, u) => `transform: translateX(min(${50 * u}vw,${50 * u}vh)) `
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
    			({
    				trial: trial.toString(),
    				previousExploit: exploitMu,
    				keyPressTime: Date.now(),
    				trialStartTime
    			});

    			$$invalidate(19, bothInvisible = false);

    			if (event.key == "ArrowLeft") {
    				greenBar += lastGreenBar;
    				redBar += lastRedBar;
    				lastGreenBar = 0;
    				lastRedBar = 0;
    				$$invalidate(10, keyView = false);
    				let newDist = sample_normal_to_twenty();
    				$$invalidate(8, exploitSelect = true);
    				await timer$4(500);
    				$$invalidate(8, exploitSelect = false);
    				$$invalidate(11, clearBoard = true);
    				await timer$4(1000);
    				$$invalidate(5, exploitMu = newDist);
    				lastGreenBar = newDist;
    				lastRedBar = 20 - newDist;
    				$$invalidate(11, clearBoard = false);
    				$$invalidate(10, keyView = true);
    				trialStartTime = Date.now();
    				currentUnderstanding = newDist;
    				$$invalidate(3, trial += 1);
    				console.log("done");
    			}

    			if (event.key == "ArrowRight") {
    				$$invalidate(4, viewExplore = true);
    				let newDist = random_int();
    				greenBar += lastGreenBar;
    				redBar += lastRedBar;
    				lastGreenBar = 0;
    				lastRedBar = 0;

    				if (newDist > exploitMu) {
    					console.log("greater than");
    					$$invalidate(10, keyView = false);
    					$$invalidate(6, exploreMu = newDist);
    					$$invalidate(7, exploreSelect = true);
    					await timer$4(500);
    					$$invalidate(7, exploreSelect = false);
    					await timer$4(500);
    					$$invalidate(5, exploitMu = newDist);
    					$$invalidate(4, viewExplore = false);
    					$$invalidate(9, replaceExploit.truth = true, replaceExploit);
    					$$invalidate(0, counter += 1);
    					await timer$4(500);
    					lastGreenBar = newDist;
    					lastRedBar = 20 - newDist;
    					$$invalidate(10, keyView = true);
    					trialStartTime = Date.now();
    					currentUnderstanding = newDist;
    					$$invalidate(3, trial += 1);
    				} else {
    					console.log("less than");
    					$$invalidate(10, keyView = false);
    					$$invalidate(6, exploreMu = newDist);
    					$$invalidate(7, exploreSelect = true);
    					await timer$4(500);
    					$$invalidate(7, exploreSelect = false);
    					await timer$4(500);
    					$$invalidate(4, viewExplore = false);
    					$$invalidate(9, replaceExploit.truth = false, replaceExploit);
    					$$invalidate(0, counter += 1);
    					await timer$4(500);
    					lastGreenBar = newDist;
    					lastRedBar = 20 - newDist;
    					$$invalidate(10, keyView = true);
    					trialStartTime = Date.now();
    					currentUnderstanding = newDist;
    					$$invalidate(3, trial += 1);
    				}
    			}

    			if (trial === numTrials + 1) {
    				$$invalidate(19, bothInvisible = true);
    			} else {
    				$$invalidate(19, bothInvisible = false);
    			}

    			if (trial === numTrials + 1) {
    				$$invalidate(10, keyView = false);
    				await timer$4(1200);
    				toNext(gameString, greenBar + lastGreenBar);
    			}
    		}
    	}

    	function sample_normal_to_twenty() {
    		let newNorm = Math.floor(sample_normal(exploitMu, trialSd));
    		newNorm = Math.min(newNorm, 20);
    		newNorm = Math.max(newNorm, 0);
    		return newNorm;
    	}

    	const writable_props = [
    		"counter",
    		"gameString",
    		"trialDescriptions",
    		"toNext",
    		"bothInvisible",
    		"breakTruth"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$4.warn(`<PracticeGame> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("gameString" in $$props) $$invalidate(21, gameString = $$props.gameString);
    		if ("trialDescriptions" in $$props) $$invalidate(1, trialDescriptions = $$props.trialDescriptions);
    		if ("toNext" in $$props) $$invalidate(22, toNext = $$props.toNext);
    		if ("bothInvisible" in $$props) $$invalidate(19, bothInvisible = $$props.bothInvisible);
    		if ("breakTruth" in $$props) $$invalidate(2, breakTruth = $$props.breakTruth);
    	};

    	$$self.$capture_state = () => ({
    		RedGreen,
    		counter,
    		viewNumber,
    		gameString,
    		trialSd,
    		numTrials,
    		trial,
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
    		lastGreenBar,
    		lastRedBar,
    		greenBar,
    		redBar,
    		trialDescriptions,
    		toNext,
    		bothInvisible,
    		breakTruth,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		timer: timer$4,
    		Send_Data_To_Exius: Send_Data_To_Exius$2,
    		handleKeydown,
    		box_mueller,
    		sample_normal,
    		sample_normal_to_twenty,
    		random_int
    	});

    	$$self.$inject_state = $$props => {
    		if ("counter" in $$props) $$invalidate(0, counter = $$props.counter);
    		if ("gameString" in $$props) $$invalidate(21, gameString = $$props.gameString);
    		if ("trialSd" in $$props) trialSd = $$props.trialSd;
    		if ("numTrials" in $$props) $$invalidate(12, numTrials = $$props.numTrials);
    		if ("trial" in $$props) $$invalidate(3, trial = $$props.trial);
    		if ("range" in $$props) $$invalidate(13, range = $$props.range);
    		if ("trialStartTime" in $$props) trialStartTime = $$props.trialStartTime;
    		if ("viewExplore" in $$props) $$invalidate(4, viewExplore = $$props.viewExplore);
    		if ("exploitMu" in $$props) $$invalidate(5, exploitMu = $$props.exploitMu);
    		if ("exploreMu" in $$props) $$invalidate(6, exploreMu = $$props.exploreMu);
    		if ("exploreSelect" in $$props) $$invalidate(7, exploreSelect = $$props.exploreSelect);
    		if ("exploitSelect" in $$props) $$invalidate(8, exploitSelect = $$props.exploitSelect);
    		if ("replaceExploit" in $$props) $$invalidate(9, replaceExploit = $$props.replaceExploit);
    		if ("keyView" in $$props) $$invalidate(10, keyView = $$props.keyView);
    		if ("clearBoard" in $$props) $$invalidate(11, clearBoard = $$props.clearBoard);
    		if ("currentUnderstanding" in $$props) currentUnderstanding = $$props.currentUnderstanding;
    		if ("lastGreenBar" in $$props) lastGreenBar = $$props.lastGreenBar;
    		if ("lastRedBar" in $$props) lastRedBar = $$props.lastRedBar;
    		if ("greenBar" in $$props) greenBar = $$props.greenBar;
    		if ("redBar" in $$props) redBar = $$props.redBar;
    		if ("trialDescriptions" in $$props) $$invalidate(1, trialDescriptions = $$props.trialDescriptions);
    		if ("toNext" in $$props) $$invalidate(22, toNext = $$props.toNext);
    		if ("bothInvisible" in $$props) $$invalidate(19, bothInvisible = $$props.bothInvisible);
    		if ("breakTruth" in $$props) $$invalidate(2, breakTruth = $$props.breakTruth);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		counter,
    		trialDescriptions,
    		breakTruth,
    		trial,
    		viewExplore,
    		exploitMu,
    		exploreMu,
    		exploreSelect,
    		exploitSelect,
    		replaceExploit,
    		keyView,
    		clearBoard,
    		numTrials,
    		range,
    		migrateLeftExplore,
    		migrateLeftExploit,
    		migrateOut,
    		InvisibleOrDown,
    		handleKeydown,
    		bothInvisible,
    		viewNumber,
    		gameString,
    		toNext
    	];
    }

    class PracticeGame extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$8,
    			create_fragment$8,
    			safe_not_equal,
    			{
    				counter: 0,
    				viewNumber: 20,
    				gameString: 21,
    				trialDescriptions: 1,
    				toNext: 22,
    				bothInvisible: 19,
    				breakTruth: 2
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PracticeGame",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*toNext*/ ctx[22] === undefined && !("toNext" in props)) {
    			console_1$4.warn("<PracticeGame> was created without expected prop 'toNext'");
    		}
    	}

    	get counter() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set counter(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get viewNumber() {
    		return this.$$.ctx[20];
    	}

    	set viewNumber(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get gameString() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set gameString(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get trialDescriptions() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set trialDescriptions(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toNext() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toNext(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bothInvisible() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bothInvisible(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get breakTruth() {
    		throw new Error("<PracticeGame>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set breakTruth(value) {
    		throw new Error("<PracticeGame>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/NavigationArrows.svelte generated by Svelte v3.34.0 */

    const { console: console_1$3 } = globals;

    function create_fragment$7(ctx) {
    	let mounted;
    	let dispose;

    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", /*handleKeydown*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			mounted = false;
    			dispose();
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

    async function timer$3(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("NavigationArrows", slots, []);
    	let { breakTruth = { truth: false } } = $$props;
    	let { nextInstruction = null } = $$props;
    	let { nextArrow } = $$props;

    	async function handleKeydown(event) {
    		if (!breakTruth.truth) {
    			if (event.key === nextArrow) {
    				console.log("hi");
    				nextInstruction();
    			}
    		}
    	}

    	const writable_props = ["breakTruth", "nextInstruction", "nextArrow"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$3.warn(`<NavigationArrows> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("breakTruth" in $$props) $$invalidate(1, breakTruth = $$props.breakTruth);
    		if ("nextInstruction" in $$props) $$invalidate(2, nextInstruction = $$props.nextInstruction);
    		if ("nextArrow" in $$props) $$invalidate(3, nextArrow = $$props.nextArrow);
    	};

    	$$self.$capture_state = () => ({
    		breakTruth,
    		nextInstruction,
    		nextArrow,
    		timer: timer$3,
    		handleKeydown
    	});

    	$$self.$inject_state = $$props => {
    		if ("breakTruth" in $$props) $$invalidate(1, breakTruth = $$props.breakTruth);
    		if ("nextInstruction" in $$props) $$invalidate(2, nextInstruction = $$props.nextInstruction);
    		if ("nextArrow" in $$props) $$invalidate(3, nextArrow = $$props.nextArrow);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [handleKeydown, breakTruth, nextInstruction, nextArrow];
    }

    class NavigationArrows extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			breakTruth: 1,
    			nextInstruction: 2,
    			nextArrow: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NavigationArrows",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*nextArrow*/ ctx[3] === undefined && !("nextArrow" in props)) {
    			console_1$3.warn("<NavigationArrows> was created without expected prop 'nextArrow'");
    		}
    	}

    	get breakTruth() {
    		throw new Error("<NavigationArrows>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set breakTruth(value) {
    		throw new Error("<NavigationArrows>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nextInstruction() {
    		throw new Error("<NavigationArrows>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nextInstruction(value) {
    		throw new Error("<NavigationArrows>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nextArrow() {
    		throw new Error("<NavigationArrows>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nextArrow(value) {
    		throw new Error("<NavigationArrows>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/ProgressBar.svelte generated by Svelte v3.34.0 */

    const file$4 = "src/Instructions/ProgressBar.svelte";

    // (80:8) {#key lastGreenBar}
    function create_key_block_3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "progressLeft svelte-1mnp72f");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*lastGreenBar*/ ctx[0] + ")");
    			set_style(div, "left", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*greenBar*/ ctx[2] + ")");
    			set_style(div, "position", "absolute");
    			add_location(div, file$4, 80, 12, 2245);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numTrials, lastGreenBar*/ 17) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*lastGreenBar*/ ctx[0] + ")");
    			}

    			if (dirty & /*numTrials, greenBar*/ 20) {
    				set_style(div, "left", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*greenBar*/ ctx[2] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_3.name,
    		type: "key",
    		source: "(80:8) {#key lastGreenBar}",
    		ctx
    	});

    	return block;
    }

    // (78:4) {#key greenBar}
    function create_key_block_2$1(ctx) {
    	let div;
    	let t;
    	let previous_key = /*lastGreenBar*/ ctx[0];
    	let key_block_anchor;
    	let key_block = create_key_block_3(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			key_block.c();
    			key_block_anchor = empty();
    			attr_dev(div, "class", "progressGreen svelte-1mnp72f");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*greenBar*/ ctx[2] + ")");
    			set_style(div, "position", "absolute");
    			add_location(div, file$4, 78, 8, 2085);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numTrials, greenBar*/ 20) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*greenBar*/ ctx[2] + ")");
    			}

    			if (dirty & /*lastGreenBar*/ 1 && safe_not_equal(previous_key, previous_key = /*lastGreenBar*/ ctx[0])) {
    				key_block.d(1);
    				key_block = create_key_block_3(ctx);
    				key_block.c();
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_2$1.name,
    		type: "key",
    		source: "(78:4) {#key greenBar}",
    		ctx
    	});

    	return block;
    }

    // (86:8) {#key lastRedBar}
    function create_key_block_1$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "progressRight svelte-1mnp72f");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*lastRedBar*/ ctx[1] + ")");
    			set_style(div, "left", "calc(min(60vh,60vw) - ((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*redBar*/ ctx[3] + ") + 1px)");
    			set_style(div, "position", "absolute");
    			add_location(div, file$4, 86, 12, 2656);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numTrials, lastRedBar*/ 18) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*lastRedBar*/ ctx[1] + ")");
    			}

    			if (dirty & /*numTrials, redBar*/ 24) {
    				set_style(div, "left", "calc(min(60vh,60vw) - ((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*redBar*/ ctx[3] + ") + 1px)");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_1$1.name,
    		type: "key",
    		source: "(86:8) {#key lastRedBar}",
    		ctx
    	});

    	return block;
    }

    // (84:4) {#key redBar}
    function create_key_block$1(ctx) {
    	let div;
    	let t;
    	let previous_key = /*lastRedBar*/ ctx[1];
    	let key_block_anchor;
    	let key_block = create_key_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			key_block.c();
    			key_block_anchor = empty();
    			attr_dev(div, "class", "progressRed svelte-1mnp72f");
    			set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*redBar*/ ctx[3] + ")");
    			set_style(div, "left", "min(60vh,60vw)");
    			set_style(div, "position", "absolute");
    			add_location(div, file$4, 84, 8, 2481);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numTrials, redBar*/ 24) {
    				set_style(div, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[4] * 20 + ") * " + /*redBar*/ ctx[3] + ")");
    			}

    			if (dirty & /*lastRedBar*/ 2 && safe_not_equal(previous_key, previous_key = /*lastRedBar*/ ctx[1])) {
    				key_block.d(1);
    				key_block = create_key_block_1$1(ctx);
    				key_block.c();
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block$1.name,
    		type: "key",
    		source: "(84:4) {#key redBar}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let h1;
    	let t1;
    	let div1;
    	let div0;
    	let t2;
    	let previous_key = /*greenBar*/ ctx[2];
    	let t3;
    	let previous_key_1 = /*redBar*/ ctx[3];
    	let key_block0 = create_key_block_2$1(ctx);
    	let key_block1 = create_key_block$1(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Total Student Understanding";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			key_block0.c();
    			t3 = space();
    			key_block1.c();
    			attr_dev(h1, "class", "classUnderstanding svelte-1mnp72f");
    			add_location(h1, file$4, 74, 0, 1839);
    			attr_dev(div0, "class", "progressBar svelte-1mnp72f");
    			set_style(div0, "left", "max(-.5vw,-.5vh)");
    			add_location(div0, file$4, 76, 4, 1995);
    			set_style(div1, "left", "calc(50vw - min(30vh,30vw))");
    			set_style(div1, "top", "min(50vh,50vw)");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$4, 75, 0, 1903);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t2);
    			key_block0.m(div1, null);
    			append_dev(div1, t3);
    			key_block1.m(div1, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*greenBar*/ 4 && safe_not_equal(previous_key, previous_key = /*greenBar*/ ctx[2])) {
    				key_block0.d(1);
    				key_block0 = create_key_block_2$1(ctx);
    				key_block0.c();
    				key_block0.m(div1, t3);
    			} else {
    				key_block0.p(ctx, dirty);
    			}

    			if (dirty & /*redBar*/ 8 && safe_not_equal(previous_key_1, previous_key_1 = /*redBar*/ ctx[3])) {
    				key_block1.d(1);
    				key_block1 = create_key_block$1(ctx);
    				key_block1.c();
    				key_block1.m(div1, null);
    			} else {
    				key_block1.p(ctx, dirty);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			key_block0.d(detaching);
    			key_block1.d(detaching);
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

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ProgressBar", slots, []);
    	let { lastGreenBar = 0 } = $$props;
    	let { lastRedBar = 0 } = $$props;
    	let { greenBar = 0 } = $$props;
    	let { redBar = 0 } = $$props;
    	let { numTrials = 30 } = $$props;
    	const writable_props = ["lastGreenBar", "lastRedBar", "greenBar", "redBar", "numTrials"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ProgressBar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("lastGreenBar" in $$props) $$invalidate(0, lastGreenBar = $$props.lastGreenBar);
    		if ("lastRedBar" in $$props) $$invalidate(1, lastRedBar = $$props.lastRedBar);
    		if ("greenBar" in $$props) $$invalidate(2, greenBar = $$props.greenBar);
    		if ("redBar" in $$props) $$invalidate(3, redBar = $$props.redBar);
    		if ("numTrials" in $$props) $$invalidate(4, numTrials = $$props.numTrials);
    	};

    	$$self.$capture_state = () => ({
    		lastGreenBar,
    		lastRedBar,
    		greenBar,
    		redBar,
    		numTrials
    	});

    	$$self.$inject_state = $$props => {
    		if ("lastGreenBar" in $$props) $$invalidate(0, lastGreenBar = $$props.lastGreenBar);
    		if ("lastRedBar" in $$props) $$invalidate(1, lastRedBar = $$props.lastRedBar);
    		if ("greenBar" in $$props) $$invalidate(2, greenBar = $$props.greenBar);
    		if ("redBar" in $$props) $$invalidate(3, redBar = $$props.redBar);
    		if ("numTrials" in $$props) $$invalidate(4, numTrials = $$props.numTrials);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [lastGreenBar, lastRedBar, greenBar, redBar, numTrials];
    }

    class ProgressBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			lastGreenBar: 0,
    			lastRedBar: 1,
    			greenBar: 2,
    			redBar: 3,
    			numTrials: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ProgressBar",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get lastGreenBar() {
    		throw new Error("<ProgressBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lastGreenBar(value) {
    		throw new Error("<ProgressBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lastRedBar() {
    		throw new Error("<ProgressBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lastRedBar(value) {
    		throw new Error("<ProgressBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get greenBar() {
    		throw new Error("<ProgressBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set greenBar(value) {
    		throw new Error("<ProgressBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get redBar() {
    		throw new Error("<ProgressBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set redBar(value) {
    		throw new Error("<ProgressBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get numTrials() {
    		throw new Error("<ProgressBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set numTrials(value) {
    		throw new Error("<ProgressBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/MonthProgress.svelte generated by Svelte v3.34.0 */

    const file$3 = "src/Instructions/MonthProgress.svelte";

    // (90:4) {#if greenScore>greenScoreLast}
    function create_if_block_2$4(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Great Job! You improved upon your classroom's understanding from the last month! Let's try and do even better in the next month!";
    			add_location(h1, file$3, 90, 8, 3172);
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
    		id: create_if_block_2$4.name,
    		type: "if",
    		source: "(90:4) {#if greenScore>greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    // (93:4) {#if greenScore<greenScoreLast}
    function create_if_block_1$4(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Oh no! It looks like your classroom's understanding dropped from the last month, let's try and beat this score next time!";
    			add_location(h1, file$3, 93, 8, 3364);
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
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(93:4) {#if greenScore<greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    // (96:4) {#if greenScore == greenScoreLast}
    function create_if_block$4(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Looks like you tied your last score! Let's try and beat that score in the next month!";
    			add_location(h1, file$3, 96, 12, 3556);
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
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(96:4) {#if greenScore == greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let h10;
    	let t1;
    	let div3;
    	let div0;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let t4;
    	let h11;
    	let t6;
    	let div7;
    	let div4;
    	let t7;
    	let div5;
    	let t8;
    	let div6;
    	let t9;
    	let div8;
    	let h12;
    	let t10;
    	let t11_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "";
    	let t11;
    	let t12;
    	let t13_value = Math.round(100 * /*greenScoreLast*/ ctx[2] / (/*numTrials*/ ctx[1] * 20)) + "";
    	let t13;
    	let t14;
    	let t15;
    	let div10;
    	let div9;
    	let t16;
    	let t17;
    	let if_block0 = /*greenScore*/ ctx[0] > /*greenScoreLast*/ ctx[2] && create_if_block_2$4(ctx);
    	let if_block1 = /*greenScore*/ ctx[0] < /*greenScoreLast*/ ctx[2] && create_if_block_1$4(ctx);
    	let if_block2 = /*greenScore*/ ctx[0] == /*greenScoreLast*/ ctx[2] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "Total Student Understanding This Month";
    			t1 = space();
    			div3 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div1 = element("div");
    			t3 = space();
    			div2 = element("div");
    			t4 = space();
    			h11 = element("h1");
    			h11.textContent = "Total Student Understanding Last Month";
    			t6 = space();
    			div7 = element("div");
    			div4 = element("div");
    			t7 = space();
    			div5 = element("div");
    			t8 = space();
    			div6 = element("div");
    			t9 = space();
    			div8 = element("div");
    			h12 = element("h1");
    			t10 = text("Your classroom's understanding at the end of this month was ");
    			t11 = text(t11_value);
    			t12 = text("%, and\n    your classroom's understanding last month was ");
    			t13 = text(t13_value);
    			t14 = text("%");
    			t15 = space();
    			div10 = element("div");
    			div9 = element("div");
    			if (if_block0) if_block0.c();
    			t16 = space();
    			if (if_block1) if_block1.c();
    			t17 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(h10, "class", "classUnderstanding svelte-1f5voqz");
    			add_location(h10, file$3, 70, 4, 1736);
    			attr_dev(div0, "class", "progressBar svelte-1f5voqz");
    			set_style(div0, "left", "max(-.5vw,-.5vh)");
    			add_location(div0, file$3, 72, 8, 1911);
    			attr_dev(div1, "class", "progressGreen svelte-1f5voqz");
    			set_style(div1, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScore*/ ctx[0] + ")");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file$3, 73, 8, 1981);
    			attr_dev(div2, "class", "progressRed svelte-1f5voqz");
    			set_style(div2, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScore*/ ctx[3] + ")");
    			set_style(div2, "left", "min(60vh,60vw)");
    			set_style(div2, "position", "absolute");
    			add_location(div2, file$3, 74, 8, 2111);
    			set_style(div3, "left", "calc(50vw - min(30vh,30vw))");
    			set_style(div3, "top", "min(25vh,25vw)");
    			set_style(div3, "position", "absolute");
    			add_location(div3, file$3, 71, 4, 1815);
    			attr_dev(h11, "class", "classUnderstanding svelte-1f5voqz");
    			set_style(h11, "top", "min(33vh,33vw)");
    			add_location(h11, file$3, 76, 4, 2265);
    			attr_dev(div4, "class", "progressBar svelte-1f5voqz");
    			set_style(div4, "left", "max(-.5vw,-.5vh)");
    			add_location(div4, file$3, 78, 8, 2467);
    			attr_dev(div5, "class", "progressGreen svelte-1f5voqz");
    			set_style(div5, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScoreLast*/ ctx[2] + ")");
    			set_style(div5, "position", "absolute");
    			add_location(div5, file$3, 79, 8, 2537);
    			attr_dev(div6, "class", "progressRed svelte-1f5voqz");
    			set_style(div6, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScoreLast*/ ctx[4] + ")");
    			set_style(div6, "left", "min(60vh,60vw)");
    			set_style(div6, "position", "absolute");
    			add_location(div6, file$3, 80, 8, 2671);
    			set_style(div7, "left", "calc(50vw - min(30vh,30vw))");
    			set_style(div7, "top", "min(38vh,38vw)");
    			set_style(div7, "position", "absolute");
    			add_location(div7, file$3, 77, 4, 2371);
    			add_location(h12, file$3, 83, 4, 2855);
    			attr_dev(div8, "class", "description svelte-1f5voqz");
    			add_location(div8, file$3, 82, 0, 2825);
    			attr_dev(div9, "class", "performanceBox svelte-1f5voqz");
    			add_location(div9, file$3, 88, 4, 3098);
    			add_location(div10, file$3, 87, 0, 3087);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t2);
    			append_dev(div3, div1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, h11, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div4);
    			append_dev(div7, t7);
    			append_dev(div7, div5);
    			append_dev(div7, t8);
    			append_dev(div7, div6);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, div8, anchor);
    			append_dev(div8, h12);
    			append_dev(h12, t10);
    			append_dev(h12, t11);
    			append_dev(h12, t12);
    			append_dev(h12, t13);
    			append_dev(h12, t14);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			if (if_block0) if_block0.m(div9, null);
    			append_dev(div9, t16);
    			if (if_block1) if_block1.m(div9, null);
    			append_dev(div9, t17);
    			if (if_block2) if_block2.m(div9, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*numTrials, greenScore*/ 3) {
    				set_style(div1, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScore*/ ctx[0] + ")");
    			}

    			if (dirty & /*numTrials*/ 2) {
    				set_style(div2, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScore*/ ctx[3] + ")");
    			}

    			if (dirty & /*numTrials, greenScoreLast*/ 6) {
    				set_style(div5, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScoreLast*/ ctx[2] + ")");
    			}

    			if (dirty & /*numTrials*/ 2) {
    				set_style(div6, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScoreLast*/ ctx[4] + ")");
    			}

    			if (dirty & /*greenScore, numTrials*/ 3 && t11_value !== (t11_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "")) set_data_dev(t11, t11_value);
    			if (dirty & /*greenScoreLast, numTrials*/ 6 && t13_value !== (t13_value = Math.round(100 * /*greenScoreLast*/ ctx[2] / (/*numTrials*/ ctx[1] * 20)) + "")) set_data_dev(t13, t13_value);

    			if (/*greenScore*/ ctx[0] > /*greenScoreLast*/ ctx[2]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_2$4(ctx);
    					if_block0.c();
    					if_block0.m(div9, t16);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*greenScore*/ ctx[0] < /*greenScoreLast*/ ctx[2]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1$4(ctx);
    					if_block1.c();
    					if_block1.m(div9, t17);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*greenScore*/ ctx[0] == /*greenScoreLast*/ ctx[2]) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block$4(ctx);
    					if_block2.c();
    					if_block2.m(div9, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div7);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div8);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(div10);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
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

    async function timer$2(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("MonthProgress", slots, []);
    	let { greenScore = 10 } = $$props;
    	let { numTrials = 30 } = $$props;
    	let { greenScoreLast = 10 } = $$props;
    	const redScore = numTrials * 20 - greenScore;
    	const redScoreLast = numTrials * 20 - greenScoreLast;
    	let transitionOffBlank = false;

    	async function blankToOn() {
    		await timer$2(500);
    		transitionOffBlank = true;
    	}

    	blankToOn();
    	const writable_props = ["greenScore", "numTrials", "greenScoreLast"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MonthProgress> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("greenScore" in $$props) $$invalidate(0, greenScore = $$props.greenScore);
    		if ("numTrials" in $$props) $$invalidate(1, numTrials = $$props.numTrials);
    		if ("greenScoreLast" in $$props) $$invalidate(2, greenScoreLast = $$props.greenScoreLast);
    	};

    	$$self.$capture_state = () => ({
    		greenScore,
    		numTrials,
    		greenScoreLast,
    		redScore,
    		redScoreLast,
    		transitionOffBlank,
    		timer: timer$2,
    		blankToOn
    	});

    	$$self.$inject_state = $$props => {
    		if ("greenScore" in $$props) $$invalidate(0, greenScore = $$props.greenScore);
    		if ("numTrials" in $$props) $$invalidate(1, numTrials = $$props.numTrials);
    		if ("greenScoreLast" in $$props) $$invalidate(2, greenScoreLast = $$props.greenScoreLast);
    		if ("transitionOffBlank" in $$props) transitionOffBlank = $$props.transitionOffBlank;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [greenScore, numTrials, greenScoreLast, redScore, redScoreLast];
    }

    class MonthProgress extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			greenScore: 0,
    			numTrials: 1,
    			greenScoreLast: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MonthProgress",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get greenScore() {
    		throw new Error("<MonthProgress>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set greenScore(value) {
    		throw new Error("<MonthProgress>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get numTrials() {
    		throw new Error("<MonthProgress>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set numTrials(value) {
    		throw new Error("<MonthProgress>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get greenScoreLast() {
    		throw new Error("<MonthProgress>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set greenScoreLast(value) {
    		throw new Error("<MonthProgress>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Instructions/Instructions.svelte generated by Svelte v3.34.0 */

    const { console: console_1$2 } = globals;
    const file$2 = "src/Instructions/Instructions.svelte";

    // (161:0) {#if i===0}
    function create_if_block_34(ctx) {
    	let fullscreen;
    	let current;

    	fullscreen = new FullScreen({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7]
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
    		id: create_if_block_34.name,
    		type: "if",
    		source: "(161:0) {#if i===0}",
    		ctx
    	});

    	return block;
    }

    // (164:0) {#if i===1}
    function create_if_block_33(ctx) {
    	let h10;
    	let t0;
    	let br;
    	let t1;
    	let t2;
    	let h11;
    	let t4;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			t0 = text("The ");
    			br = element("br");
    			t1 = text("Teaching Task");
    			t2 = space();
    			h11 = element("h1");
    			h11.textContent = "Click Next to Start the Task";
    			t4 = space();
    			create_component(navigationbuttons.$$.fragment);
    			add_location(br, file$2, 164, 30, 4954);
    			attr_dev(h10, "class", "titleText svelte-1d7ghio");
    			add_location(h10, file$2, 164, 4, 4928);
    			set_style(h11, "top", "70vh");
    			set_style(h11, "width", "min(60vw,60vh)");
    			set_style(h11, "left", "calc(50vw - min(20vw,20vh))");
    			set_style(h11, "position", "absolute");
    			set_style(h11, "font-size", "min(3vh,3vw)");
    			add_location(h11, file$2, 165, 4, 4982);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			append_dev(h10, t0);
    			append_dev(h10, br);
    			append_dev(h10, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, h11, anchor);
    			insert_dev(target, t4, anchor);
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
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t4);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_33.name,
    		type: "if",
    		source: "(164:0) {#if i===1}",
    		ctx
    	});

    	return block;
    }

    // (169:0) {#if i ===2}
    function create_if_block_32(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "For this experiment, you will play a teaching task.  Please read through these instructions carefully.\n         Remember that this is an important part of our study. Please give this task adequate time and effort, and try to get the best results.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 169, 4, 5216);
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
    		id: create_if_block_32.name,
    		type: "if",
    		source: "(169:0) {#if i ===2}",
    		ctx
    	});

    	return block;
    }

    // (176:0) {#if i ===3}
    function create_if_block_31(ctx) {
    	let h1;
    	let t1;
    	let textarea;
    	let t2;
    	let navigationbuttons;
    	let current;
    	let mounted;
    	let dispose;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "To start off, we want you to take a moment to think about and describe your current math warm up in 1 or 2 sentences.";
    			t1 = space();
    			textarea = element("textarea");
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 176, 0, 5640);
    			attr_dev(textarea, "rows", "4");
    			attr_dev(textarea, "wrap", "soft");
    			attr_dev(textarea, "placeholder", "Input description here...");
    			attr_dev(textarea, "class", "textBox svelte-1d7ghio");
    			add_location(textarea, file$2, 179, 4, 5805);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*warmUp*/ ctx[5]);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[13]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*warmUp*/ 32) {
    				set_input_value(textarea, /*warmUp*/ ctx[5]);
    			}
    		},
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
    			if (detaching) detach_dev(textarea);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_31.name,
    		type: "if",
    		source: "(176:0) {#if i ===3}",
    		ctx
    	});

    	return block;
    }

    // (183:0) {#if i ===4}
    function create_if_block_30(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Now, we want you to imagine that your math coach or colleague has suggested a new approach for your math warm up.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 183, 0, 6043);
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
    		source: "(183:0) {#if i ===4}",
    		ctx
    	});

    	return block;
    }

    // (189:0) {#if i ===5}
    function create_if_block_29(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "In this experiment  - the teaching task - we would like you to choose between two teaching approaches for your math warm up, (1) your current math warm up that seems to be working well or (2) the “new” suggested approach for your math warm up.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 189, 0, 6313);
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
    		id: create_if_block_29.name,
    		type: "if",
    		source: "(189:0) {#if i ===5}",
    		ctx
    	});

    	return block;
    }

    // (194:0) {#if i ===6}
    function create_if_block_28(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "For the purposes of this task, we will keep the teaching approaches generic (“current” approach or “new” approach by the coach) but we want you to imagine what those approaches might be (i.e. starting with a group problem, a quick review worksheet, calendar time, or a math discussion).";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 194, 4, 6720);
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
    		source: "(194:0) {#if i ===6}",
    		ctx
    	});

    	return block;
    }

    // (200:0) {#if i ===7}
    function create_if_block_27(ctx) {
    	let h10;
    	let t1;
    	let div;
    	let t2;
    	let h11;
    	let t4;
    	let img;
    	let img_src_value;
    	let t5;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "To get feedback on how well the approach worked, your students will display a red light or green light to show their understanding.";
    			t1 = space();
    			div = element("div");
    			t2 = space();
    			h11 = element("h1");
    			h11.textContent = "How much did you understand?";
    			t4 = space();
    			img = element("img");
    			t5 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h10, "class", "descriptionText svelte-1d7ghio");
    			add_location(h10, file$2, 200, 4, 7178);
    			attr_dev(div, "class", "imageBox svelte-1d7ghio");
    			add_location(div, file$2, 203, 4, 7363);
    			attr_dev(h11, "class", "imageText svelte-1d7ghio");
    			add_location(h11, file$2, 204, 4, 7397);
    			attr_dev(img, "class", "imageScale svelte-1d7ghio");
    			if (img.src !== (img_src_value = "https://cdn.vox-cdn.com/thumbor/8XjPCHo_W0zCH1YDoR3ST3cN51E=/0x0:6720x4480/920x613/filters:focal(2823x1703:3897x2777)/cdn.vox-cdn.com/uploads/chorus_image/image/64906829/f9c5667541.0.jpeg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "temp");
    			add_location(img, file$2, 205, 4, 7459);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, h11, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, img, anchor);
    			insert_dev(target, t5, anchor);
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
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(img);
    			if (detaching) detach_dev(t5);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_27.name,
    		type: "if",
    		source: "(200:0) {#if i ===7}",
    		ctx
    	});

    	return block;
    }

    // (209:0) {#if i ===8}
    function create_if_block_26(ctx) {
    	let h10;
    	let t1;
    	let div0;
    	let t2;
    	let h11;
    	let t4;
    	let div1;
    	let h12;
    	let t6;
    	let div2;
    	let h13;
    	let t8;
    	let h14;
    	let t10;
    	let h15;
    	let t12;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "The response of a student holding up a red or green card after being asked might be like:";
    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			h11 = element("h1");
    			h11.textContent = "How much did you understand?";
    			t4 = space();
    			div1 = element("div");
    			h12 = element("h1");
    			h12.textContent = "R";
    			t6 = space();
    			div2 = element("div");
    			h13 = element("h1");
    			h13.textContent = "G";
    			t8 = space();
    			h14 = element("h1");
    			h14.textContent = "I do not get it! This did not help me.";
    			t10 = space();
    			h15 = element("h1");
    			h15.textContent = "I understand!\n            I am happy with how this went.";
    			t12 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h10, "class", "descriptionText svelte-1d7ghio");
    			add_location(h10, file$2, 209, 4, 7813);
    			attr_dev(div0, "class", "imageBox svelte-1d7ghio");
    			add_location(div0, file$2, 212, 4, 7954);
    			attr_dev(h11, "class", "imageText svelte-1d7ghio");
    			add_location(h11, file$2, 213, 4, 7987);
    			attr_dev(h12, "style", "top:50%;left50%;height:20%;width:20%;margin:0% 25%");
    			add_location(h12, file$2, 215, 12, 8140);
    			attr_dev(div1, "class", "redGreenBall svelte-1d7ghio");
    			set_style(div1, "background-color", "red");
    			set_style(div1, "top", "min(31vh,31vw)");
    			add_location(div1, file$2, 214, 8, 8053);
    			attr_dev(h13, "style", "top:50%;left50%;height:20%;width:20%;margin:2% 20%");
    			add_location(h13, file$2, 218, 12, 8324);
    			attr_dev(div2, "class", "redGreenBall svelte-1d7ghio");
    			set_style(div2, "background-color", "green");
    			set_style(div2, "top", "min(51vh,51vw)");
    			add_location(div2, file$2, 217, 8, 8233);
    			attr_dev(h14, "class", "understandBox svelte-1d7ghio");
    			set_style(h14, "top", "min(30vh,30vw)");
    			add_location(h14, file$2, 220, 8, 8417);
    			attr_dev(h15, "class", "understandBox svelte-1d7ghio");
    			set_style(h15, "top", "min(50vh,50vw)");
    			add_location(h15, file$2, 223, 8, 8544);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, h11, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h12);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h13);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, h14, anchor);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, h15, anchor);
    			insert_dev(target, t12, anchor);
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
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(h14);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(h15);
    			if (detaching) detach_dev(t12);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_26.name,
    		type: "if",
    		source: "(209:0) {#if i ===8}",
    		ctx
    	});

    	return block;
    }

    // (229:0) {#if i ===9}
    function create_if_block_25(ctx) {
    	let singlechoice;
    	let t;
    	let navigationbuttons;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "You have a class of 20 students. Each student is represented by a circle. A teaching approach, or move, can have different outcomes day to day. On the first day you try it, you might get 12 students showing green and 8 showing red (shown below)",
    				exploitSelect: false,
    				exploitMu: 12
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
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
    		id: create_if_block_25.name,
    		type: "if",
    		source: "(229:0) {#if i ===9}",
    		ctx
    	});

    	return block;
    }

    // (233:0) {#if i ===10}
    function create_if_block_24(ctx) {
    	let singlechoice;
    	let t;
    	let navigationbuttons;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "And the second day you try the same move it might not work so well - 9 students showing green and 11 showing red.",
    				exploitSelect: false,
    				exploitMu: 9
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
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
    		id: create_if_block_24.name,
    		type: "if",
    		source: "(233:0) {#if i ===10}",
    		ctx
    	});

    	return block;
    }

    // (237:0) {#if i ===11}
    function create_if_block_23(ctx) {
    	let singlechoice;
    	let t;
    	let navigationbuttons;
    	let current;

    	singlechoice = new SingleChoice({
    			props: {
    				passedText: "And on the next day you might try the same move and get slightly better results - 15 students showing green and 5 showing red. As you can see, the same move can get slightly better or worse results over time but stays fairly close to what it was the day before.",
    				exploitSelect: false,
    				exploitMu: 15
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
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
    		source: "(237:0) {#if i ===11}",
    		ctx
    	});

    	return block;
    }

    // (241:0) {#if i === 12}
    function create_if_block_22(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationbuttons;
    	let current;
    	doublechoice = new DoubleChoice({ props: { exploitMu: 11 }, $$inline: true });

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
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
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 241, 4, 9998);
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
    		id: create_if_block_22.name,
    		type: "if",
    		source: "(241:0) {#if i === 12}",
    		ctx
    	});

    	return block;
    }

    // (249:0) {#if i ===13}
    function create_if_block_21(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let previous_key = /*animationCounter*/ ctx[6];
    	let key_block_anchor;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8],
    				replayAnimation: /*replayAnimation*/ ctx[9]
    			},
    			$$inline: true
    		});

    	let key_block = create_key_block_2(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "If you choose to continue with your current teaching approach, it will light up with a blue border and a new outcome will appear.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			key_block.c();
    			key_block_anchor = empty();
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 249, 4, 10444);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);

    			if (dirty & /*animationCounter*/ 64 && safe_not_equal(previous_key, previous_key = /*animationCounter*/ ctx[6])) {
    				group_outros();
    				transition_out(key_block, 1, 1, noop);
    				check_outros();
    				key_block = create_key_block_2(ctx);
    				key_block.c();
    				transition_in(key_block);
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(key_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(key_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_21.name,
    		type: "if",
    		source: "(249:0) {#if i ===13}",
    		ctx
    	});

    	return block;
    }

    // (253:4) {#key animationCounter}
    function create_key_block_2(ctx) {
    	let doublechoice;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				delayExploit: true,
    				exploitMu: 11
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(doublechoice.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_2.name,
    		type: "key",
    		source: "(253:4) {#key animationCounter}",
    		ctx
    	});

    	return block;
    }

    // (257:0) {#if i ===14}
    function create_if_block_20(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				exploreSelect: true,
    				viewExplore: true,
    				exploitMu: 11
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Or if you choose to switch to the new approach, it will light up and show the results like this…";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			create_component(doublechoice.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 257, 0, 10911);
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
    		id: create_if_block_20.name,
    		type: "if",
    		source: "(257:0) {#if i ===14}",
    		ctx
    	});

    	return block;
    }

    // (263:0) {#if i === 15}
    function create_if_block_19(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let previous_key = /*animationCounter*/ ctx[6];
    	let key_block_anchor;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8],
    				replayAnimation: /*replayAnimation*/ ctx[9]
    			},
    			$$inline: true
    		});

    	let key_block = create_key_block_1(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "If the new approach is worse than the current approach, you earn fewer points on the trial. Then, since it is worse, this new approach is discarded.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			key_block.c();
    			key_block_anchor = empty();
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 263, 4, 11279);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);

    			if (dirty & /*animationCounter*/ 64 && safe_not_equal(previous_key, previous_key = /*animationCounter*/ ctx[6])) {
    				group_outros();
    				transition_out(key_block, 1, 1, noop);
    				check_outros();
    				key_block = create_key_block_1(ctx);
    				key_block.c();
    				transition_in(key_block);
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(key_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(key_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_19.name,
    		type: "if",
    		source: "(263:0) {#if i === 15}",
    		ctx
    	});

    	return block;
    }

    // (267:4) {#key animationCounter}
    function create_key_block_1(ctx) {
    	let doublechoice;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				delayBadExplore: true,
    				exploitMu: 11,
    				noReplaceExplore: true
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(doublechoice.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block_1.name,
    		type: "key",
    		source: "(267:4) {#key animationCounter}",
    		ctx
    	});

    	return block;
    }

    // (271:0) {#if i === 16}
    function create_if_block_18(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let doublechoice;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
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
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 271, 4, 11795);
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
    		id: create_if_block_18.name,
    		type: "if",
    		source: "(271:0) {#if i === 16}",
    		ctx
    	});

    	return block;
    }

    // (277:0) {#if i === 17}
    function create_if_block_17(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let t2;
    	let previous_key = /*animationCounter*/ ctx[6];
    	let key_block_anchor;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8],
    				replayAnimation: /*replayAnimation*/ ctx[9]
    			},
    			$$inline: true
    		});

    	let key_block = create_key_block(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "If you were to try the new approach and it is better than the current approach,  it will replace your current approach for your next choice.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			t2 = space();
    			key_block.c();
    			key_block_anchor = empty();
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 277, 4, 12153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			insert_dev(target, t2, anchor);
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationbuttons_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationbuttons_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationbuttons.$set(navigationbuttons_changes);

    			if (dirty & /*animationCounter*/ 64 && safe_not_equal(previous_key, previous_key = /*animationCounter*/ ctx[6])) {
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
    			transition_in(navigationbuttons.$$.fragment, local);
    			transition_in(key_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navigationbuttons.$$.fragment, local);
    			transition_out(key_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(navigationbuttons, detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_17.name,
    		type: "if",
    		source: "(277:0) {#if i === 17}",
    		ctx
    	});

    	return block;
    }

    // (281:4) {#key animationCounter}
    function create_key_block(ctx) {
    	let doublechoice;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				delayGoodExplore: true,
    				exploitMu: 11,
    				exploreMu: 16,
    				noReplaceExplore: true
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(doublechoice.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block.name,
    		type: "key",
    		source: "(281:4) {#key animationCounter}",
    		ctx
    	});

    	return block;
    }

    // (285:0) {#if i === 18}
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
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
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
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 285, 4, 12678);
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
    		source: "(285:0) {#if i === 18}",
    		ctx
    	});

    	return block;
    }

    // (291:0) {#if i === 19}
    function create_if_block_15(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "To recap, you need to choose between you current approach and a new approach.  Choosing you current approach gives you a similar result to what you got last time (slightly better or worse).  Choosing a new approach give you a totally new outcome(that can be a lot better or a lot worse).";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 291, 4, 12982);
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
    		id: create_if_block_15.name,
    		type: "if",
    		source: "(291:0) {#if i === 19}",
    		ctx
    	});

    	return block;
    }

    // (296:0) {#if i === 20}
    function create_if_block_14(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Before you begin, to make sure you've got everything, we will walk you through several trials...";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 296, 4, 13434);
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
    		id: create_if_block_14.name,
    		type: "if",
    		source: "(296:0) {#if i === 20}",
    		ctx
    	});

    	return block;
    }

    // (301:0) {#if i === 21}
    function create_if_block_13(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationarrows;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				exploitMu: 12,
    				keyDisplay: true
    			},
    			$$inline: true
    		});

    	navigationarrows = new NavigationArrows({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				nextArrow: "ArrowLeft"
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
    			create_component(navigationarrows.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 301, 4, 13695);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationarrows, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationarrows_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationarrows_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationarrows.$set(navigationarrows_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationarrows.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationarrows.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationarrows, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(301:0) {#if i === 21}",
    		ctx
    	});

    	return block;
    }

    // (306:0) {#if i=== 22}
    function create_if_block_12(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationarrows;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				keyDisplay: true,
    				delayExploit: true,
    				exploitMu: 12,
    				exploitMu2: 13,
    				delayTime: 0
    			},
    			$$inline: true
    		});

    	navigationarrows = new NavigationArrows({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				nextArrow: "ArrowLeft"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "We can see that when we tried our current teaching approach it got better! So, we may want to keep trying that approach (press the left arrow)";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			t2 = space();
    			create_component(navigationarrows.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 306, 4, 14098);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationarrows, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationarrows_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationarrows_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationarrows.$set(navigationarrows_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationarrows.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationarrows.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationarrows, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(306:0) {#if i=== 22}",
    		ctx
    	});

    	return block;
    }

    // (311:0) {#if i=== 23}
    function create_if_block_11(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationarrows;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				keyDisplay: true,
    				delayExploit: true,
    				exploitMu: 13,
    				exploitMu2: 8,
    				delayTime: 0
    			},
    			$$inline: true
    		});

    	navigationarrows = new NavigationArrows({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				nextArrow: "ArrowRight"
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
    			create_component(navigationarrows.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 311, 4, 14527);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationarrows, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationarrows_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationarrows_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationarrows.$set(navigationarrows_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationarrows.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationarrows.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationarrows, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(311:0) {#if i=== 23}",
    		ctx
    	});

    	return block;
    }

    // (316:0) {#if i=== 24}
    function create_if_block_10(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let t2;
    	let navigationarrows;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				keyDisplay: true,
    				delayBadExplore: true,
    				exploitMu: 8,
    				exploreMu: 1,
    				delayTime: 0
    			},
    			$$inline: true
    		});

    	navigationarrows = new NavigationArrows({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				nextArrow: "ArrowRight"
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
    			create_component(navigationarrows.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 316, 4, 14980);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationarrows, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const navigationarrows_changes = {};
    			if (dirty & /*breakTruth*/ 2) navigationarrows_changes.breakTruth = /*breakTruth*/ ctx[1];
    			navigationarrows.$set(navigationarrows_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			transition_in(navigationarrows.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			transition_out(navigationarrows.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationarrows, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(316:0) {#if i=== 24}",
    		ctx
    	});

    	return block;
    }

    // (321:0) {#if i=== 25}
    function create_if_block_9$1(ctx) {
    	let h1;
    	let t1;
    	let doublechoice;
    	let current;

    	doublechoice = new DoubleChoice({
    			props: {
    				breakNav: /*breakNav*/ ctx[10],
    				keyDisplay: true,
    				delayGoodExplore: true,
    				exploitMu: 8,
    				exploreMu: 15,
    				delayTime: 0
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Great! We seem to have found a much better approach when we tried another new approach. Now it is your turn to try a couple of trials by yourself. Choose either the left or right arrow to make your decision.";
    			t1 = space();
    			create_component(doublechoice.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 321, 4, 15481);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(doublechoice, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doublechoice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doublechoice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(doublechoice, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9$1.name,
    		type: "if",
    		source: "(321:0) {#if i=== 25}",
    		ctx
    	});

    	return block;
    }

    // (325:0) {#if i === 26}
    function create_if_block_8$1(ctx) {
    	let practicegame;
    	let current;

    	practicegame = new PracticeGame({
    			props: {
    				breakTruth: /*breakTruth*/ ctx[1],
    				toNext: /*nextInstruction*/ ctx[7],
    				trialDescriptions: [
    					"Great! We seem to have found a much better approach when we tried another new approach. Now it is your turn to try a couple of trials by yourself. Choose either the left or right arrow to make your decision.",
    					"Lets try another, 3 practice trials left",
    					"Lets try another, 2 practice trials left",
    					"Lets try another, 1 practice trials left",
    					""
    				]
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
    		p: function update(ctx, dirty) {
    			const practicegame_changes = {};
    			if (dirty & /*breakTruth*/ 2) practicegame_changes.breakTruth = /*breakTruth*/ ctx[1];
    			practicegame.$set(practicegame_changes);
    		},
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
    		id: create_if_block_8$1.name,
    		type: "if",
    		source: "(325:0) {#if i === 26}",
    		ctx
    	});

    	return block;
    }

    // (334:0) {#if i ===27}
    function create_if_block_7$1(ctx) {
    	let h10;
    	let t1;
    	let h11;
    	let t6;
    	let h12;
    	let t11;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8],
    				backSkip: 7
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "The game will be organized into days and months, and the current day/month will be displayed at the top of your screen.\n         Every time you choose either your current teaching move or a new teaching move, it will increase your day count. At the end of 30 days, a new month\n        will happen. Here is the display you would see if you were currently on day 5 of the second month.";
    			t1 = space();
    			h11 = element("h1");
    			h11.textContent = `Day ${5} of ${30}`;
    			t6 = space();
    			h12 = element("h1");
    			h12.textContent = `Month ${2} of ${6}`;
    			t11 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h10, "class", "descriptionText svelte-1d7ghio");
    			add_location(h10, file$2, 334, 4, 16348);
    			attr_dev(h11, "class", "points svelte-1d7ghio");
    			add_location(h11, file$2, 337, 4, 16770);
    			attr_dev(h12, "class", "points svelte-1d7ghio");
    			set_style(h12, "left", "calc(50vw - min(50vw, 50vh))");
    			add_location(h12, file$2, 338, 4, 16815);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h11, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, h12, anchor);
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
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(h12);
    			if (detaching) detach_dev(t11);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7$1.name,
    		type: "if",
    		source: "(334:0) {#if i ===27}",
    		ctx
    	});

    	return block;
    }

    // (342:0) {#if i ===28}
    function create_if_block_6$1(ctx) {
    	let h1;
    	let t1;
    	let progressbar;
    	let t2;
    	let navigationbuttons;
    	let current;

    	progressbar = new ProgressBar({
    			props: {
    				lastGreenBar: 15,
    				lastRedBar: 5,
    				greenBar: 250,
    				redBar: 210,
    				numTrials: 30
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Your points will be kept track of with a progress bar at the top of your screen. The total bar length represents your total accumulated red and green lights this month. The flashing sections\n        represent the red and green lights that you recieved on your last choice.";
    			t1 = space();
    			create_component(progressbar.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 342, 4, 17038);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(progressbar, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(progressbar.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(progressbar.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(progressbar, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6$1.name,
    		type: "if",
    		source: "(342:0) {#if i ===28}",
    		ctx
    	});

    	return block;
    }

    // (348:0) {#if i === 29}
    function create_if_block_5$1(ctx) {
    	let h10;
    	let t1;
    	let h11;
    	let t6;
    	let h12;
    	let t11;
    	let progressbar;
    	let t12;
    	let navigationbuttons;
    	let current;

    	progressbar = new ProgressBar({
    			props: {
    				lastGreenBar: 15,
    				lastRedBar: 5,
    				greenBar: 250,
    				redBar: 210,
    				numTrials: 30
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "So, all together, the top of your screen will look something like:";
    			t1 = space();
    			h11 = element("h1");
    			h11.textContent = `Day ${23} of ${30}`;
    			t6 = space();
    			h12 = element("h1");
    			h12.textContent = `Month ${2} of ${6}`;
    			t11 = space();
    			create_component(progressbar.$$.fragment);
    			t12 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h10, "class", "descriptionText svelte-1d7ghio");
    			add_location(h10, file$2, 348, 4, 17568);
    			attr_dev(h11, "class", "points svelte-1d7ghio");
    			add_location(h11, file$2, 349, 4, 17672);
    			attr_dev(h12, "class", "points svelte-1d7ghio");
    			set_style(h12, "left", "calc(50vw - min(50vw, 50vh))");
    			add_location(h12, file$2, 350, 4, 17718);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h11, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, h12, anchor);
    			insert_dev(target, t11, anchor);
    			mount_component(progressbar, target, anchor);
    			insert_dev(target, t12, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(progressbar.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(progressbar.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h11);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(h12);
    			if (detaching) detach_dev(t11);
    			destroy_component(progressbar, detaching);
    			if (detaching) detach_dev(t12);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5$1.name,
    		type: "if",
    		source: "(348:0) {#if i === 29}",
    		ctx
    	});

    	return block;
    }

    // (355:0) {#if i ===30}
    function create_if_block_4$2(ctx) {
    	let h1;
    	let t1;
    	let monthprogress;
    	let t2;
    	let navigationbuttons;
    	let current;

    	monthprogress = new MonthProgress({
    			props: {
    				greenScore: 380,
    				greenScoreLast: 300,
    				numTrials: 30
    			},
    			$$inline: true
    		});

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "At the end of each month, you will be shown a screen giving your performance that month and the month before. This gives you a chance to \n    improve upon your score between months! If you improved upon your previous, you would see something like:";
    			t1 = space();
    			create_component(monthprogress.$$.fragment);
    			t2 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 355, 0, 18021);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(monthprogress, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(navigationbuttons, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(monthprogress.$$.fragment, local);
    			transition_in(navigationbuttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(monthprogress.$$.fragment, local);
    			transition_out(navigationbuttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			destroy_component(monthprogress, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(navigationbuttons, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$2.name,
    		type: "if",
    		source: "(355:0) {#if i ===30}",
    		ctx
    	});

    	return block;
    }

    // (362:0) {#if i === 31}
    function create_if_block_3$2(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Now that you've seen all the parts of the game, lets have you do a couple of rounds by yourself. The classroom understanding bar will be added into these trials.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 362, 4, 18503);
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
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(362:0) {#if i === 31}",
    		ctx
    	});

    	return block;
    }

    // (367:0) {#if i === 32}
    function create_if_block_2$3(ctx) {
    	let game;
    	let current;

    	game = new Game({
    			props: {
    				toNext: /*sendGameUpstream*/ ctx[11],
    				gameString: "",
    				writeKey: /*writeKey*/ ctx[3],
    				id: /*id*/ ctx[4],
    				totalBlocks: 0,
    				block: 0,
    				numTrials: 10
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
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(367:0) {#if i === 32}",
    		ctx
    	});

    	return block;
    }

    // (370:0) {#if i === 33}
    function create_if_block_1$3(ctx) {
    	let h1;
    	let t1;
    	let navigationbuttons;
    	let current;

    	navigationbuttons = new NavigationButtons({
    			props: {
    				nextInstruction: /*nextInstruction*/ ctx[7],
    				previousInstruction: /*previousInstruction*/ ctx[8],
    				backSkip: 2
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "At this point you should have a firm understanding of the task. This task will go for 6 months of 30 days each. Remember to maximize your students' understanding, and good luck! To review any of the instructions click back, to continue to the task click next.";
    			t1 = space();
    			create_component(navigationbuttons.$$.fragment);
    			attr_dev(h1, "class", "descriptionText svelte-1d7ghio");
    			add_location(h1, file$2, 370, 4, 18973);
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
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(370:0) {#if i === 33}",
    		ctx
    	});

    	return block;
    }

    // (375:0) {#if i === 34}
    function create_if_block$3(ctx) {
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
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(375:0) {#if i === 34}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
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
    	let t32;
    	let t33;
    	let if_block34_anchor;
    	let current;
    	let if_block0 = /*i*/ ctx[0] === 0 && create_if_block_34(ctx);
    	let if_block1 = /*i*/ ctx[0] === 1 && create_if_block_33(ctx);
    	let if_block2 = /*i*/ ctx[0] === 2 && create_if_block_32(ctx);
    	let if_block3 = /*i*/ ctx[0] === 3 && create_if_block_31(ctx);
    	let if_block4 = /*i*/ ctx[0] === 4 && create_if_block_30(ctx);
    	let if_block5 = /*i*/ ctx[0] === 5 && create_if_block_29(ctx);
    	let if_block6 = /*i*/ ctx[0] === 6 && create_if_block_28(ctx);
    	let if_block7 = /*i*/ ctx[0] === 7 && create_if_block_27(ctx);
    	let if_block8 = /*i*/ ctx[0] === 8 && create_if_block_26(ctx);
    	let if_block9 = /*i*/ ctx[0] === 9 && create_if_block_25(ctx);
    	let if_block10 = /*i*/ ctx[0] === 10 && create_if_block_24(ctx);
    	let if_block11 = /*i*/ ctx[0] === 11 && create_if_block_23(ctx);
    	let if_block12 = /*i*/ ctx[0] === 12 && create_if_block_22(ctx);
    	let if_block13 = /*i*/ ctx[0] === 13 && create_if_block_21(ctx);
    	let if_block14 = /*i*/ ctx[0] === 14 && create_if_block_20(ctx);
    	let if_block15 = /*i*/ ctx[0] === 15 && create_if_block_19(ctx);
    	let if_block16 = /*i*/ ctx[0] === 16 && create_if_block_18(ctx);
    	let if_block17 = /*i*/ ctx[0] === 17 && create_if_block_17(ctx);
    	let if_block18 = /*i*/ ctx[0] === 18 && create_if_block_16(ctx);
    	let if_block19 = /*i*/ ctx[0] === 19 && create_if_block_15(ctx);
    	let if_block20 = /*i*/ ctx[0] === 20 && create_if_block_14(ctx);
    	let if_block21 = /*i*/ ctx[0] === 21 && create_if_block_13(ctx);
    	let if_block22 = /*i*/ ctx[0] === 22 && create_if_block_12(ctx);
    	let if_block23 = /*i*/ ctx[0] === 23 && create_if_block_11(ctx);
    	let if_block24 = /*i*/ ctx[0] === 24 && create_if_block_10(ctx);
    	let if_block25 = /*i*/ ctx[0] === 25 && create_if_block_9$1(ctx);
    	let if_block26 = /*i*/ ctx[0] === 26 && create_if_block_8$1(ctx);
    	let if_block27 = /*i*/ ctx[0] === 27 && create_if_block_7$1(ctx);
    	let if_block28 = /*i*/ ctx[0] === 28 && create_if_block_6$1(ctx);
    	let if_block29 = /*i*/ ctx[0] === 29 && create_if_block_5$1(ctx);
    	let if_block30 = /*i*/ ctx[0] === 30 && create_if_block_4$2(ctx);
    	let if_block31 = /*i*/ ctx[0] === 31 && create_if_block_3$2(ctx);
    	let if_block32 = /*i*/ ctx[0] === 32 && create_if_block_2$3(ctx);
    	let if_block33 = /*i*/ ctx[0] === 33 && create_if_block_1$3(ctx);
    	let if_block34 = /*i*/ ctx[0] === 34 && create_if_block$3(ctx);

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
    			t32 = space();
    			if (if_block33) if_block33.c();
    			t33 = space();
    			if (if_block34) if_block34.c();
    			if_block34_anchor = empty();
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
    			insert_dev(target, t32, anchor);
    			if (if_block33) if_block33.m(target, anchor);
    			insert_dev(target, t33, anchor);
    			if (if_block34) if_block34.m(target, anchor);
    			insert_dev(target, if_block34_anchor, anchor);
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
    					if_block0 = create_if_block_34(ctx);
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
    					if_block1 = create_if_block_33(ctx);
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
    					if_block2 = create_if_block_32(ctx);
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

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_31(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(t3.parentNode, t3);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 4) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block_30(ctx);
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
    					if_block5 = create_if_block_29(ctx);
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
    					if_block6 = create_if_block_28(ctx);
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
    					if_block7 = create_if_block_27(ctx);
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
    					if_block8 = create_if_block_26(ctx);
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
    					if_block9 = create_if_block_25(ctx);
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
    					if_block10 = create_if_block_24(ctx);
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
    					if_block11 = create_if_block_23(ctx);
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
    					if_block12 = create_if_block_22(ctx);
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
    					if_block13 = create_if_block_21(ctx);
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
    					if_block14 = create_if_block_20(ctx);
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
    					if_block15 = create_if_block_19(ctx);
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
    					if_block16 = create_if_block_18(ctx);
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
    					if_block17 = create_if_block_17(ctx);
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
    					if_block18 = create_if_block_16(ctx);
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
    					if_block19 = create_if_block_15(ctx);
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
    					if_block20 = create_if_block_14(ctx);
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
    					if_block21 = create_if_block_13(ctx);
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
    					if_block22 = create_if_block_12(ctx);
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
    					if_block23 = create_if_block_11(ctx);
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
    					if_block24 = create_if_block_10(ctx);
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
    					if_block25 = create_if_block_9$1(ctx);
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
    					if_block26 = create_if_block_8$1(ctx);
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
    					if_block27 = create_if_block_7$1(ctx);
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
    					if_block28 = create_if_block_6$1(ctx);
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
    					if_block29 = create_if_block_5$1(ctx);
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
    					if_block30 = create_if_block_4$2(ctx);
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
    					if_block31 = create_if_block_3$2(ctx);
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

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block32, 1);
    					}
    				} else {
    					if_block32 = create_if_block_2$3(ctx);
    					if_block32.c();
    					transition_in(if_block32, 1);
    					if_block32.m(t32.parentNode, t32);
    				}
    			} else if (if_block32) {
    				group_outros();

    				transition_out(if_block32, 1, 1, () => {
    					if_block32 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 33) {
    				if (if_block33) {
    					if_block33.p(ctx, dirty);

    					if (dirty & /*i*/ 1) {
    						transition_in(if_block33, 1);
    					}
    				} else {
    					if_block33 = create_if_block_1$3(ctx);
    					if_block33.c();
    					transition_in(if_block33, 1);
    					if_block33.m(t33.parentNode, t33);
    				}
    			} else if (if_block33) {
    				group_outros();

    				transition_out(if_block33, 1, 1, () => {
    					if_block33 = null;
    				});

    				check_outros();
    			}

    			if (/*i*/ ctx[0] === 34) {
    				if (if_block34) {
    					if_block34.p(ctx, dirty);
    				} else {
    					if_block34 = create_if_block$3(ctx);
    					if_block34.c();
    					if_block34.m(if_block34_anchor.parentNode, if_block34_anchor);
    				}
    			} else if (if_block34) {
    				if_block34.d(1);
    				if_block34 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
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
    			transition_in(if_block32);
    			transition_in(if_block33);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
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
    			transition_out(if_block32);
    			transition_out(if_block33);
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
    			if (detaching) detach_dev(t32);
    			if (if_block33) if_block33.d(detaching);
    			if (detaching) detach_dev(t33);
    			if (if_block34) if_block34.d(detaching);
    			if (detaching) detach_dev(if_block34_anchor);
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

    async function timer$1(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Instructions", slots, []);
    	let { toGame } = $$props;
    	let { i = 0 } = $$props;
    	let { breakTruth = { truth: false } } = $$props;
    	let { getData } = $$props;
    	let { writeKey } = $$props;
    	let { id } = $$props;
    	let animationCounter = 0;
    	let practiceData = undefined;
    	let warmUp = "";

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

    	function replayAnimation() {
    		console.log(animationCounter);
    		$$invalidate(6, animationCounter += 1);
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

    		$$invalidate(0, i += 1);
    	}

    	async function iterate_i() {
    		await timer$1(3000);
    		$$invalidate(0, i += 1);
    	}

    	const writable_props = ["toGame", "i", "breakTruth", "getData", "writeKey", "id"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$2.warn(`<Instructions> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		warmUp = this.value;
    		$$invalidate(5, warmUp);
    	}

    	$$self.$$set = $$props => {
    		if ("toGame" in $$props) $$invalidate(2, toGame = $$props.toGame);
    		if ("i" in $$props) $$invalidate(0, i = $$props.i);
    		if ("breakTruth" in $$props) $$invalidate(1, breakTruth = $$props.breakTruth);
    		if ("getData" in $$props) $$invalidate(12, getData = $$props.getData);
    		if ("writeKey" in $$props) $$invalidate(3, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(4, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		NavigationButtons,
    		SingleChoice,
    		DoubleChoice,
    		FullScreen,
    		PracticeGame,
    		NavigationArrows,
    		ProgressBar,
    		MonthProgress,
    		Game,
    		toGame,
    		i,
    		breakTruth,
    		getData,
    		writeKey,
    		id,
    		animationCounter,
    		practiceData,
    		warmUp,
    		nextInstruction,
    		previousInstruction,
    		replayAnimation,
    		breakNav,
    		sendGameUpstream,
    		Send_Data_To_Exius: Send_Data_To_Exius$1,
    		timer: timer$1,
    		iterate_i
    	});

    	$$self.$inject_state = $$props => {
    		if ("toGame" in $$props) $$invalidate(2, toGame = $$props.toGame);
    		if ("i" in $$props) $$invalidate(0, i = $$props.i);
    		if ("breakTruth" in $$props) $$invalidate(1, breakTruth = $$props.breakTruth);
    		if ("getData" in $$props) $$invalidate(12, getData = $$props.getData);
    		if ("writeKey" in $$props) $$invalidate(3, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(4, id = $$props.id);
    		if ("animationCounter" in $$props) $$invalidate(6, animationCounter = $$props.animationCounter);
    		if ("practiceData" in $$props) practiceData = $$props.practiceData;
    		if ("warmUp" in $$props) $$invalidate(5, warmUp = $$props.warmUp);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*i, id, warmUp, writeKey*/ 57) {
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

    		if ($$self.$$.dirty & /*i*/ 1) {
    			{
    				if (i === 25) {
    					iterate_i();
    				}
    			}
    		}
    	};

    	return [
    		i,
    		breakTruth,
    		toGame,
    		writeKey,
    		id,
    		warmUp,
    		animationCounter,
    		nextInstruction,
    		previousInstruction,
    		replayAnimation,
    		breakNav,
    		sendGameUpstream,
    		getData,
    		textarea_input_handler
    	];
    }

    class Instructions extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			toGame: 2,
    			i: 0,
    			breakTruth: 1,
    			getData: 12,
    			writeKey: 3,
    			id: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Instructions",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*toGame*/ ctx[2] === undefined && !("toGame" in props)) {
    			console_1$2.warn("<Instructions> was created without expected prop 'toGame'");
    		}

    		if (/*getData*/ ctx[12] === undefined && !("getData" in props)) {
    			console_1$2.warn("<Instructions> was created without expected prop 'getData'");
    		}

    		if (/*writeKey*/ ctx[3] === undefined && !("writeKey" in props)) {
    			console_1$2.warn("<Instructions> was created without expected prop 'writeKey'");
    		}

    		if (/*id*/ ctx[4] === undefined && !("id" in props)) {
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

    function create_fragment$3(ctx) {
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Redirect",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/Password.svelte generated by Svelte v3.34.0 */

    const { Object: Object_1, console: console_1$1 } = globals;
    const file$1 = "src/Password.svelte";

    // (63:0) {#if preflightInitiated}
    function create_if_block_2$2(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Checking Credentials...";
    			add_location(h1, file$1, 63, 4, 2337);
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
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(63:0) {#if preflightInitiated}",
    		ctx
    	});

    	return block;
    }

    // (66:0) {#if preflightError}
    function create_if_block_1$2(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Error in preflight";
    			add_location(h1, file$1, 66, 4, 2401);
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
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(66:0) {#if preflightError}",
    		ctx
    	});

    	return block;
    }

    // (69:0) {#if Object.keys(preflightFileFail).length !== 0}
    function create_if_block$2(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "preflightFileFail";
    			add_location(h1, file$1, 69, 4, 2489);
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
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(69:0) {#if Object.keys(preflightFileFail).length !== 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let t0;
    	let t1;
    	let show_if = Object.keys(/*preflightFileFail*/ ctx[1]).length !== 0;
    	let if_block2_anchor;
    	let if_block0 = /*preflightInitiated*/ ctx[0] && create_if_block_2$2(ctx);
    	let if_block1 = /*preflightError*/ ctx[2] && create_if_block_1$2(ctx);
    	let if_block2 = show_if && create_if_block$2(ctx);

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
    					if_block0 = create_if_block_2$2(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*preflightError*/ ctx[2]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1$2(ctx);
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
    					if_block2 = create_if_block$2(ctx);
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
    		id: create_fragment$2.name,
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

    function instance$2($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { writeKeyPass: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Password",
    			options,
    			id: create_fragment$2.name
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

    /* src/BlockEnd.svelte generated by Svelte v3.34.0 */

    const file = "src/BlockEnd.svelte";

    // (85:0) {#if transitionOffBlank}
    function create_if_block$1(ctx) {
    	let h10;
    	let t1;
    	let div3;
    	let div0;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let t4;
    	let t5;
    	let t6;
    	let button;
    	let h11;
    	let mounted;
    	let dispose;
    	let if_block0 = !/*firstBlock*/ ctx[2] && create_if_block_9(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*firstBlock*/ ctx[2]) return create_if_block_1$1;
    		if (/*lastBlock*/ ctx[3]) return create_if_block_2$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "Total Student Understanding This Month";
    			t1 = space();
    			div3 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div1 = element("div");
    			t3 = space();
    			div2 = element("div");
    			t4 = space();
    			if (if_block0) if_block0.c();
    			t5 = space();
    			if_block1.c();
    			t6 = space();
    			button = element("button");
    			h11 = element("h1");
    			h11.textContent = "Start Next Month";
    			attr_dev(h10, "class", "classUnderstanding svelte-1pk8o6r");
    			add_location(h10, file, 85, 4, 2073);
    			attr_dev(div0, "class", "progressBar svelte-1pk8o6r");
    			set_style(div0, "left", "max(-.5vw,-.5vh)");
    			add_location(div0, file, 87, 8, 2248);
    			attr_dev(div1, "class", "progressGreen svelte-1pk8o6r");
    			set_style(div1, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScore*/ ctx[0] + ")");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file, 88, 8, 2318);
    			attr_dev(div2, "class", "progressRed svelte-1pk8o6r");
    			set_style(div2, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScore*/ ctx[7] + ")");
    			set_style(div2, "left", "min(60vh,60vw)");
    			set_style(div2, "position", "absolute");
    			add_location(div2, file, 89, 8, 2448);
    			set_style(div3, "left", "calc(50vw - min(30vh,30vw))");
    			set_style(div3, "top", "min(10vh,10vw)");
    			set_style(div3, "position", "absolute");
    			add_location(div3, file, 86, 4, 2152);
    			add_location(h11, file, 146, 8, 5700);
    			attr_dev(button, "class", "fancyButton svelte-1pk8o6r");
    			add_location(button, file, 145, 4, 5641);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t2);
    			append_dev(div3, div1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			insert_dev(target, t4, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t5, anchor);
    			if_block1.m(target, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, button, anchor);
    			append_dev(button, h11);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*nextYear*/ ctx[5]())) /*nextYear*/ ctx[5]().apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*numTrials, greenScore*/ 3) {
    				set_style(div1, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScore*/ ctx[0] + ")");
    			}

    			if (dirty & /*numTrials*/ 2) {
    				set_style(div2, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScore*/ ctx[7] + ")");
    			}

    			if (!/*firstBlock*/ ctx[2]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_9(ctx);
    					if_block0.c();
    					if_block0.m(t5.parentNode, t5);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(t6.parentNode, t6);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t4);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t5);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(85:0) {#if transitionOffBlank}",
    		ctx
    	});

    	return block;
    }

    // (92:4) {#if !firstBlock}
    function create_if_block_9(ctx) {
    	let h1;
    	let t1;
    	let div3;
    	let div0;
    	let t2;
    	let div1;
    	let t3;
    	let div2;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Total Student Understanding Last Month";
    			t1 = space();
    			div3 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div1 = element("div");
    			t3 = space();
    			div2 = element("div");
    			attr_dev(h1, "class", "classUnderstanding svelte-1pk8o6r");
    			set_style(h1, "top", "min(15vh,15vw)");
    			add_location(h1, file, 92, 8, 2628);
    			attr_dev(div0, "class", "progressBar svelte-1pk8o6r");
    			set_style(div0, "left", "max(-.5vw,-.5vh)");
    			add_location(div0, file, 94, 12, 2838);
    			attr_dev(div1, "class", "progressGreen svelte-1pk8o6r");
    			set_style(div1, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScoreLast*/ ctx[4] + ")");
    			set_style(div1, "position", "absolute");
    			add_location(div1, file, 95, 12, 2912);
    			attr_dev(div2, "class", "progressRed svelte-1pk8o6r");
    			set_style(div2, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScoreLast*/ ctx[8] + ")");
    			set_style(div2, "left", "min(60vh,60vw)");
    			set_style(div2, "position", "absolute");
    			add_location(div2, file, 96, 12, 3050);
    			set_style(div3, "left", "calc(50vw - min(30vh,30vw))");
    			set_style(div3, "top", "min(20vh,20vw)");
    			set_style(div3, "position", "absolute");
    			add_location(div3, file, 93, 8, 2738);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t2);
    			append_dev(div3, div1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numTrials, greenScoreLast*/ 18) {
    				set_style(div1, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*greenScoreLast*/ ctx[4] + ")");
    			}

    			if (dirty & /*numTrials*/ 2) {
    				set_style(div2, "width", "calc((min(60vh,60vw) / " + /*numTrials*/ ctx[1] * 20 + ") * " + /*redScoreLast*/ ctx[8] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(92:4) {#if !firstBlock}",
    		ctx
    	});

    	return block;
    }

    // (126:4) {:else}
    function create_else_block$1(ctx) {
    	let div0;
    	let h1;
    	let t0;
    	let t1_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "";
    	let t1;
    	let t2;
    	let t3_value = Math.round(100 * /*greenScoreLast*/ ctx[4] / (/*numTrials*/ ctx[1] * 20)) + "";
    	let t3;
    	let t4;
    	let t5;
    	let div2;
    	let div1;
    	let t6;
    	let t7;
    	let if_block0 = /*greenScore*/ ctx[0] > /*greenScoreLast*/ ctx[4] && create_if_block_8(ctx);
    	let if_block1 = /*greenScore*/ ctx[0] < /*greenScoreLast*/ ctx[4] && create_if_block_7(ctx);
    	let if_block2 = /*greenScore*/ ctx[0] == /*greenScoreLast*/ ctx[4] && create_if_block_6(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Your classroom's understanding at the end of this month was ");
    			t1 = text(t1_value);
    			t2 = text("%, and\n            your classroom's understanding last month was ");
    			t3 = text(t3_value);
    			t4 = text("%");
    			t5 = space();
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			t7 = space();
    			if (if_block2) if_block2.c();
    			add_location(h1, file, 127, 12, 4669);
    			attr_dev(div0, "class", "description svelte-1pk8o6r");
    			add_location(div0, file, 126, 8, 4631);
    			attr_dev(div1, "class", "clearfix performanceBox svelte-1pk8o6r");
    			add_location(div1, file, 132, 12, 4952);
    			add_location(div2, file, 131, 8, 4933);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(h1, t3);
    			append_dev(h1, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t6);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div1, t7);
    			if (if_block2) if_block2.m(div1, null);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*greenScore, numTrials*/ 3 && t1_value !== (t1_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*greenScoreLast, numTrials*/ 18 && t3_value !== (t3_value = Math.round(100 * /*greenScoreLast*/ ctx[4] / (/*numTrials*/ ctx[1] * 20)) + "")) set_data_dev(t3, t3_value);

    			if (/*greenScore*/ ctx[0] > /*greenScoreLast*/ ctx[4]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_8(ctx);
    					if_block0.c();
    					if_block0.m(div1, t6);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*greenScore*/ ctx[0] < /*greenScoreLast*/ ctx[4]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_7(ctx);
    					if_block1.c();
    					if_block1.m(div1, t7);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*greenScore*/ ctx[0] == /*greenScoreLast*/ ctx[4]) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_6(ctx);
    					if_block2.c();
    					if_block2.m(div1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div2);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(126:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (107:24) 
    function create_if_block_2$1(ctx) {
    	let div0;
    	let h1;
    	let t0;
    	let t1_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "";
    	let t1;
    	let t2;
    	let t3_value = Math.round(100 * /*greenScoreLast*/ ctx[4] / (/*numTrials*/ ctx[1] * 20)) + "";
    	let t3;
    	let t4;
    	let t5;
    	let div2;
    	let div1;
    	let t6;
    	let t7;
    	let if_block0 = /*greenScore*/ ctx[0] > /*greenScoreLast*/ ctx[4] && create_if_block_5(ctx);
    	let if_block1 = /*greenScore*/ ctx[0] < /*greenScoreLast*/ ctx[4] && create_if_block_4$1(ctx);
    	let if_block2 = /*greenScore*/ ctx[0] == /*greenScoreLast*/ ctx[4] && create_if_block_3$1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Your classroom's understanding at the end of this month was ");
    			t1 = text(t1_value);
    			t2 = text("%, and\n            your classroom's understanding last month was ");
    			t3 = text(t3_value);
    			t4 = text("%");
    			t5 = space();
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			t7 = space();
    			if (if_block2) if_block2.c();
    			add_location(h1, file, 108, 12, 3644);
    			attr_dev(div0, "class", "description svelte-1pk8o6r");
    			add_location(div0, file, 107, 8, 3606);
    			attr_dev(div1, "class", "clearfix performanceBox svelte-1pk8o6r");
    			add_location(div1, file, 113, 12, 3927);
    			add_location(div2, file, 112, 8, 3908);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(h1, t3);
    			append_dev(h1, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t6);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div1, t7);
    			if (if_block2) if_block2.m(div1, null);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*greenScore, numTrials*/ 3 && t1_value !== (t1_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*greenScoreLast, numTrials*/ 18 && t3_value !== (t3_value = Math.round(100 * /*greenScoreLast*/ ctx[4] / (/*numTrials*/ ctx[1] * 20)) + "")) set_data_dev(t3, t3_value);

    			if (/*greenScore*/ ctx[0] > /*greenScoreLast*/ ctx[4]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					if_block0.m(div1, t6);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*greenScore*/ ctx[0] < /*greenScoreLast*/ ctx[4]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_4$1(ctx);
    					if_block1.c();
    					if_block1.m(div1, t7);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*greenScore*/ ctx[0] == /*greenScoreLast*/ ctx[4]) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_3$1(ctx);
    					if_block2.c();
    					if_block2.m(div1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div2);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(107:24) ",
    		ctx
    	});

    	return block;
    }

    // (100:4) {#if firstBlock}
    function create_if_block_1$1(ctx) {
    	let div0;
    	let h10;
    	let t0;
    	let t1_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "";
    	let t1;
    	let t2;
    	let t3;
    	let div1;
    	let h11;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h10 = element("h1");
    			t0 = text("Your classroom's understanding at the end of this semester was ");
    			t1 = text(t1_value);
    			t2 = text("%");
    			t3 = space();
    			div1 = element("div");
    			h11 = element("h1");
    			h11.textContent = "Good job on your first month! Let's try and do even better next month!";
    			add_location(h10, file, 101, 12, 3285);
    			attr_dev(div0, "class", "description svelte-1pk8o6r");
    			add_location(div0, file, 100, 8, 3247);
    			add_location(h11, file, 104, 12, 3477);
    			attr_dev(div1, "class", "clearfix performanceBox svelte-1pk8o6r");
    			add_location(div1, file, 103, 8, 3426);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h10);
    			append_dev(h10, t0);
    			append_dev(h10, t1);
    			append_dev(h10, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h11);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*greenScore, numTrials*/ 3 && t1_value !== (t1_value = Math.round(100 * /*greenScore*/ ctx[0] / (/*numTrials*/ ctx[1] * 20)) + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(100:4) {#if firstBlock}",
    		ctx
    	});

    	return block;
    }

    // (134:12) {#if greenScore>greenScoreLast}
    function create_if_block_8(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Great Job! You improved upon your classroom's understanding from the last month! Let's try and do even better in the next month!";
    			add_location(h1, file, 134, 16, 5051);
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
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(134:12) {#if greenScore>greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    // (137:12) {#if greenScore<greenScoreLast}
    function create_if_block_7(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Oh no! It looks like your classroom's understanding dropped from the last month, let's try and beat this score next time!";
    			add_location(h1, file, 137, 16, 5267);
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
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(137:12) {#if greenScore<greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    // (140:12) {#if greenScore == greenScoreLast}
    function create_if_block_6(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Looks like you tied your last score! Let's try and beat that score in the next month!";
    			add_location(h1, file, 140, 20, 5483);
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
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(140:12) {#if greenScore == greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    // (115:12) {#if greenScore>greenScoreLast}
    function create_if_block_5(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Great Job! You improved upon your classroom's understanding from the last month! Click the button below to finish the experiment!";
    			add_location(h1, file, 115, 16, 4026);
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
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(115:12) {#if greenScore>greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    // (118:12) {#if greenScore<greenScoreLast}
    function create_if_block_4$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Oh no! It looks like your classroom's understanding dropped from the last month! Click the button below to finish the experiment!";
    			add_location(h1, file, 118, 16, 4243);
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
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(118:12) {#if greenScore<greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    // (121:12) {#if greenScore == greenScoreLast}
    function create_if_block_3$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Looks like you tied your last score! Click the button below to finish the experiment!";
    			add_location(h1, file, 121, 20, 4467);
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
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(121:12) {#if greenScore == greenScoreLast}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*transitionOffBlank*/ ctx[6] && create_if_block$1(ctx);

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
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*transitionOffBlank*/ ctx[6]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
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

    async function timer(time) {
    	return await new Promise(r => setTimeout(r, time));
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("BlockEnd", slots, []);
    	let { greenScore = 10 } = $$props;
    	let { numTrials = 30 } = $$props;
    	let { firstBlock = false } = $$props;
    	let { lastBlock = false } = $$props;
    	let { greenScoreLast = 10 } = $$props;
    	let { nextYear } = $$props;
    	const redScore = numTrials * 20 - greenScore;
    	const redScoreLast = numTrials * 20 - greenScoreLast;
    	let transitionOffBlank = false;

    	async function blankToOn() {
    		await timer(500);
    		$$invalidate(6, transitionOffBlank = true);
    	}

    	blankToOn();

    	const writable_props = [
    		"greenScore",
    		"numTrials",
    		"firstBlock",
    		"lastBlock",
    		"greenScoreLast",
    		"nextYear"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<BlockEnd> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("greenScore" in $$props) $$invalidate(0, greenScore = $$props.greenScore);
    		if ("numTrials" in $$props) $$invalidate(1, numTrials = $$props.numTrials);
    		if ("firstBlock" in $$props) $$invalidate(2, firstBlock = $$props.firstBlock);
    		if ("lastBlock" in $$props) $$invalidate(3, lastBlock = $$props.lastBlock);
    		if ("greenScoreLast" in $$props) $$invalidate(4, greenScoreLast = $$props.greenScoreLast);
    		if ("nextYear" in $$props) $$invalidate(5, nextYear = $$props.nextYear);
    	};

    	$$self.$capture_state = () => ({
    		greenScore,
    		numTrials,
    		firstBlock,
    		lastBlock,
    		greenScoreLast,
    		nextYear,
    		redScore,
    		redScoreLast,
    		transitionOffBlank,
    		timer,
    		blankToOn
    	});

    	$$self.$inject_state = $$props => {
    		if ("greenScore" in $$props) $$invalidate(0, greenScore = $$props.greenScore);
    		if ("numTrials" in $$props) $$invalidate(1, numTrials = $$props.numTrials);
    		if ("firstBlock" in $$props) $$invalidate(2, firstBlock = $$props.firstBlock);
    		if ("lastBlock" in $$props) $$invalidate(3, lastBlock = $$props.lastBlock);
    		if ("greenScoreLast" in $$props) $$invalidate(4, greenScoreLast = $$props.greenScoreLast);
    		if ("nextYear" in $$props) $$invalidate(5, nextYear = $$props.nextYear);
    		if ("transitionOffBlank" in $$props) $$invalidate(6, transitionOffBlank = $$props.transitionOffBlank);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		greenScore,
    		numTrials,
    		firstBlock,
    		lastBlock,
    		greenScoreLast,
    		nextYear,
    		transitionOffBlank,
    		redScore,
    		redScoreLast
    	];
    }

    class BlockEnd extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			greenScore: 0,
    			numTrials: 1,
    			firstBlock: 2,
    			lastBlock: 3,
    			greenScoreLast: 4,
    			nextYear: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "BlockEnd",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*nextYear*/ ctx[5] === undefined && !("nextYear" in props)) {
    			console.warn("<BlockEnd> was created without expected prop 'nextYear'");
    		}
    	}

    	get greenScore() {
    		throw new Error("<BlockEnd>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set greenScore(value) {
    		throw new Error("<BlockEnd>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get numTrials() {
    		throw new Error("<BlockEnd>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set numTrials(value) {
    		throw new Error("<BlockEnd>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get firstBlock() {
    		throw new Error("<BlockEnd>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set firstBlock(value) {
    		throw new Error("<BlockEnd>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lastBlock() {
    		throw new Error("<BlockEnd>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lastBlock(value) {
    		throw new Error("<BlockEnd>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get greenScoreLast() {
    		throw new Error("<BlockEnd>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set greenScoreLast(value) {
    		throw new Error("<BlockEnd>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nextYear() {
    		throw new Error("<BlockEnd>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nextYear(value) {
    		throw new Error("<BlockEnd>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Control.svelte generated by Svelte v3.34.0 */

    const { console: console_1 } = globals;

    // (44:0) {#if !passedKey}
    function create_if_block_4(ctx) {
    	let password;
    	let current;

    	password = new Password({
    			props: { writeKeyPass: /*getWriteKey*/ ctx[13] },
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
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(44:0) {#if !passedKey}",
    		ctx
    	});

    	return block;
    }

    // (47:0) {#if passedKey && instructionsDone===false}
    function create_if_block_3(ctx) {
    	let instructions;
    	let current;

    	instructions = new Instructions({
    			props: {
    				toGame: /*toGame*/ ctx[10],
    				getData: /*getData*/ ctx[12],
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
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(47:0) {#if passedKey && instructionsDone===false}",
    		ctx
    	});

    	return block;
    }

    // (50:0) {#if (instructionsDone && !gameEnd)}
    function create_if_block_1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*yearEnd*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
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
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
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
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(50:0) {#if (instructionsDone && !gameEnd)}",
    		ctx
    	});

    	return block;
    }

    // (53:4) {:else}
    function create_else_block(ctx) {
    	let game;
    	let current;

    	game = new Game({
    			props: {
    				toNext: /*toNext*/ ctx[11],
    				gameString: /*gameData*/ ctx[5],
    				writeKey: /*writeKey*/ ctx[3],
    				id: /*id*/ ctx[4],
    				totalBlocks: /*years*/ ctx[8],
    				block: /*yearCounter*/ ctx[7]
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
    			if (dirty & /*yearCounter*/ 128) game_changes.block = /*yearCounter*/ ctx[7];
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
    		id: create_else_block.name,
    		type: "else",
    		source: "(53:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (51:4) {#if yearEnd}
    function create_if_block_2(ctx) {
    	let blockend;
    	let current;

    	blockend = new BlockEnd({
    			props: {
    				greenScore: /*greenArray*/ ctx[9][/*greenArray*/ ctx[9].length - 1],
    				greenScoreLast: /*greenArray*/ ctx[9].length > 1
    				? /*greenArray*/ ctx[9][/*greenArray*/ ctx[9].length - 2]
    				: null,
    				firstBlock: /*greenArray*/ ctx[9].length > 1 ? false : true,
    				nextYear: /*nextYear*/ ctx[14],
    				lastBlock: /*greenArray*/ ctx[9].length === /*years*/ ctx[8]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(blockend.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(blockend, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(blockend.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(blockend.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(blockend, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(51:4) {#if yearEnd}",
    		ctx
    	});

    	return block;
    }

    // (59:0) {#if gameEnd}
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
    		source: "(59:0) {#if gameEnd}",
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
    	let if_block0 = !/*passedKey*/ ctx[2] && create_if_block_4(ctx);
    	let if_block1 = /*passedKey*/ ctx[2] && /*instructionsDone*/ ctx[0] === false && create_if_block_3(ctx);
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
    					if_block0 = create_if_block_4(ctx);
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
    					if_block1 = create_if_block_3(ctx);
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
    	let years = 6;
    	let yearEnd = false;
    	let greenArray = [];
    	let yearCounter = 1;

    	function toGame() {
    		$$invalidate(0, instructionsDone = true);
    	}

    	function toNext(data, greens) {
    		if (yearCounter < years) {
    			$$invalidate(6, yearEnd = true);
    			$$invalidate(5, gameData = data);
    			greenArray.push(greens);
    			$$invalidate(7, yearCounter += 1);
    		} else {
    			$$invalidate(1, gameEnd = true);
    		}
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

    	function nextYear() {
    		$$invalidate(6, yearEnd = false);
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
    		BlockEnd,
    		instructionsDone,
    		gameEnd,
    		passedKey,
    		writeKey,
    		id,
    		gameData,
    		years,
    		yearEnd,
    		greenArray,
    		yearCounter,
    		toGame,
    		toNext,
    		getData,
    		getWriteKey,
    		nextYear
    	});

    	$$self.$inject_state = $$props => {
    		if ("instructionsDone" in $$props) $$invalidate(0, instructionsDone = $$props.instructionsDone);
    		if ("gameEnd" in $$props) $$invalidate(1, gameEnd = $$props.gameEnd);
    		if ("passedKey" in $$props) $$invalidate(2, passedKey = $$props.passedKey);
    		if ("writeKey" in $$props) $$invalidate(3, writeKey = $$props.writeKey);
    		if ("id" in $$props) $$invalidate(4, id = $$props.id);
    		if ("gameData" in $$props) $$invalidate(5, gameData = $$props.gameData);
    		if ("years" in $$props) $$invalidate(8, years = $$props.years);
    		if ("yearEnd" in $$props) $$invalidate(6, yearEnd = $$props.yearEnd);
    		if ("greenArray" in $$props) $$invalidate(9, greenArray = $$props.greenArray);
    		if ("yearCounter" in $$props) $$invalidate(7, yearCounter = $$props.yearCounter);
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
    		yearEnd,
    		yearCounter,
    		years,
    		greenArray,
    		toGame,
    		toNext,
    		getData,
    		getWriteKey,
    		nextYear
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
