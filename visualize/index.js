import * as gui3d from './gui3d.js'
const { ref, reactive } = Vue

// fetch fusion blossom runtime data
const urlParams = new URLSearchParams(window.location.search)
const filename = urlParams.get('filename') || "default.json"

var fusion_data

// create vue3 app
const App = {
    setup() {
        return {
            error_message: ref(null),
            snapshot_num: ref(1),
            snapshot_select: ref(0),
            snapshot_select_label: ref(""),
            snapshot_labels: reactive([]),
            use_perspective_camera: gui3d.use_perspective_camera,
            sizes: gui3d.sizes,
            // GUI related states
            show_stats: gui3d.show_stats,
            show_config: gui3d.show_config,
            show_hover_effect: gui3d.show_hover_effect,
            lock_view: ref(false),
            // select
            current_selected: gui3d.current_selected,
            selected_node_neighbor_edges: ref([]),
            selected_node_attributes: ref(""),
        }
    },
    async mounted() {
        try {
            let response = await fetch('./data/' + filename, { cache: 'no-cache', })
            fusion_data = await response.json()
            console.log(fusion_data)
        } catch (e) {
            this.error_message = "fetch file error"
            throw e
        }
        this.show_snapshot(0)  // load the first snapshot
        this.snapshot_num = fusion_data.snapshots.length
        for (let [idx, [name, _]] of fusion_data.snapshots.entries()) {
            this.snapshot_labels.push(`[${idx}] ${name}`)
        }
        this.snapshot_select_label = this.snapshot_labels[0]
        // only if data loads successfully will the animation starts
        gui3d.animate()
        // add keyboard shortcuts
        document.onkeydown = (event) => {
            if (!event.metaKey) {
                if (event.key == "t" || event.key == "T") {
                    this.reset_camera("top")
                } else if (event.key == "l" || event.key == "L") {
                    this.reset_camera("left")
                } else if (event.key == "f" || event.key == "F") {
                    this.reset_camera("front")
                } else if (event.key == "c" || event.key == "C") {
                    this.show_config = !this.show_config
                } else if (event.key == "s" || event.key == "S") {
                    this.show_stats = !this.show_stats
                } else if (event.key == "v" || event.key == "V") {
                    this.lock_view = !this.lock_view
                } else if (event.key == "o" || event.key == "O") {
                    this.use_perspective_camera = false
                } else if (event.key == "p" || event.key == "P") {
                    this.use_perspective_camera = true
                } else if (event.key == "ArrowRight") {
                    if (this.snapshot_select < this.snapshot_num - 1) {
                        this.snapshot_select += 1
                    }
                } else if (event.key == "ArrowLeft") {
                    if (this.snapshot_select > 0) {
                        this.snapshot_select -= 1
                    }
                } else {
                    return  // unrecognized, propagate to other listeners
                }
                event.preventDefault()
                event.stopPropagation()
            }
        }
        this.current_selected = {type: "node", node_index: 49}
        this.selected_node_neighbor_edges = [
            {
                edge_index: 0,
                left_grown: 40,
                unexplored: 0,
                right_grown: 0,
                weight: 40,
                node_index: 3,
            },
            {
                edge_index: 1,
                left_grown: 10,
                unexplored: 20,
                right_grown: 10,
                weight: 40,
                node_index: 4,
            },
            {
                edge_index: 2,
                left_grown: 0,
                unexplored: 0,
                right_grown: 40,
                weight: 40,
                node_index: 2,
            },
        ]
    },
    methods: {
        show_snapshot(snapshot_idx) {
            try {
                gui3d.show_snapshot(snapshot_idx, fusion_data)
            } catch (e) {
                this.error_message = "load data error"
                throw e
            }
        },
        reset_camera(direction) {
            gui3d.reset_camera_position(direction)
        },
        update_selected_display() {
            if (this.current_selected.type == "node") {
                let node_index = this.current_selected.node_index
                let snapshot = fusion_data.snapshots[this.snapshot_select][1]
                let node = snapshot.nodes[node_index]
                this.selected_node_attributes = ""
                if (node.s == 1) {
                    this.selected_node_attributes = "(syndrome)"
                } else if (node.v == 1) {
                    this.selected_node_attributes = "(virtual)"
                }
                console.assert(!(node.s == 1 && node.v == 1), "a node cannot be both syndrome and virtual")
                // fetch edge list
                let neighbor_edges = []
                for (let [edge_index, edge] of snapshot.edges.entries()) {
                    if (edge.l == node_index) {
                        neighbor_edges.push({
                            edge_index: edge_index,
                            left_grown: edge.lg,
                            unexplored: edge.w - edge.lg - edge.rg,
                            right_grown: edge.rg,
                            weight: edge.w,
                            node_index: edge.r,
                        })
                    } else if (edge.r == node_index) {
                        neighbor_edges.push({
                            edge_index: edge_index,
                            left_grown: edge.rg,
                            unexplored: edge.w - edge.lg - edge.rg,
                            right_grown: edge.lg,
                            weight: edge.w,
                            node_index: edge.l,
                        })
                    }
                }
                this.selected_node_neighbor_edges = neighbor_edges
            }
        },
        jump_to(type, data, is_click=true) {
            let current_ref = is_click ? gui3d.current_selected : gui3d.current_hover
            if (type == "edge") {
                current_ref.value = {
                    type, edge_index: data
                }
            }
            if (type == "node") {
                current_ref.value = {
                    type, node_index: data
                }
            }
        },
        mouseenter(type, data) {
            this.jump_to(type, data, false)
        },
        mouseleave() {
            gui3d.current_hover.value = null
        },
    },
    watch: {
        snapshot_select() {
            // console.log(this.snapshot_select)
            this.show_snapshot(this.snapshot_select)  // load the snapshot
            this.snapshot_select_label = this.snapshot_labels[this.snapshot_select]
            this.update_selected_display()
        },
        snapshot_select_label() {
            this.snapshot_select = parseInt(this.snapshot_select_label.split(']')[0].split('[')[1])
        },
        current_selected() {
            this.update_selected_display()
        },
        lock_view() {
            gui3d.enable_control.value = !this.lock_view
        },
    },
    computed: {
        scale() {
            return this.sizes.scale
        },
        vertical_thumb_style() {
            return {
                right: `4px`,
                borderRadius: `5px`,
                backgroundColor: '#027be3',
                width: `5px`,
                opacity: 0.75
            }
        },
        horizontal_thumb_style() {
            return {
                bottom: `4px`,
                borderRadius: `5px`,
                backgroundColor: '#027be3',
                height: `5px`,
                opacity: 0.75
            }
        },
        vertical_bar_style() {
            return {
                right: `2px`,
                borderRadius: `9px`,
                backgroundColor: '#027be3',
                width: `9px`,
                opacity: 0.2
            }
        },
        horizontal_bar_style() {
            return {
                bottom: `2px`,
                borderRadius: `9px`,
                backgroundColor: '#027be3',
                height: `9px`,
                opacity: 0.2
            }
        },
    },
}
const app = Vue.createApp(App)
app.use(Quasar)
Quasar.Screen.setSizes({ sm: 1200, md: 1600, lg: 2880, xl: 3840 })
app.mount("#app")
window.app = app
