<template>
  <UModal
    v-model:open="isOpen"
    :ui="{ content: 'sm:max-w-2xl' }"
    title="Google fonts"
  >
    <template #body>
      <div v-if="loading">
        <Loader class="h-6 w-6 text-blue-500 mx-auto" />
      </div>
      <div v-else>
        <text-input
          v-model="search"
          name="search"
          placeholder="Search fonts"
        />

        <div
          ref="scrollContainer"
          class="grid grid-cols-3 gap-2 p-5 mb-5 overflow-y-scroll max-h-[24rem] border rounded-md bg-neutral-50"
        >
          <FontCard
            v-for="(fontName, index) in enrichedFonts"
            :key="fontName"
            :ref="el => setFontRef(el, index)"
            :font-name="fontName"
            :is-visible="visible[index]"
            :is-selected="selectedFont === fontName"
            @select-font="selectedFont = fontName"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        size="md"
        color="neutral"
        variant="outline"
        @click="$emit('apply', null)"
      >
        Reset
      </UButton>
      <UButton
        size="md"
        :disabled="!selectedFont"
        @click="$emit('apply', selectedFont)"
      >
        Apply
      </UButton>
    </template>
  </UModal>
</template>

<script setup>
import { defineEmits } from "vue"
import Fuse from "fuse.js"
import { refDebounced, useElementVisibility } from "@vueuse/core"
import FontCard from './FontCard.vue'
import { contentApi } from "~/api"

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  font: {
    type: String,
    default: null,
  },
})

// Modal state
const isOpen = computed({
  get: () => props.show,
  set: (value) => {
    if (!value) {
      emit('close')
    }
  }
})

const emit = defineEmits(['close', 'apply'])

const loading = ref(false)
const fonts = ref([])
const selectedFont = ref(props.font || null)
const search = ref("")
const debouncedSearch = refDebounced(search, 500)
const scrollContainer = ref(null)
const fontRefs = new Map()
const visible = ref([])

const setFontRef = (el, index) => {
  if (el) fontRefs.set(index, el)
}

const initializeVisibilityTracking = async () => {
  await nextTick() // Ensure DOM has been fully updated
  fontRefs.forEach((el, index) => {
    const visibility = useElementVisibility(el, {
      root: scrollContainer.value,
      threshold: 0.1
    })
    watch(
      () => visibility.value,
      (isVisible) => {
        if (isVisible) {
          visible.value[index] = true
        }
      },
      { immediate: true }
    )
  })
}

const fetchFonts = async () => {
  if (props.show) {
    selectedFont.value = props.font || null
    loading.value = true
    contentApi.fonts.list().then((data) => {
      fonts.value = data || []
      loading.value = false
      initializeVisibilityTracking()
    })
  }
}
watch(() => props.show, fetchFonts)


const enrichedFonts = computed(() => {
  if (search.value === "" || search.value === null) {
    return fonts.value
  }

  // Fuze search
  const fuse = new Fuse(Object.values(fonts.value))
  return fuse.search(debouncedSearch.value).map((res) => {
    return res.item
  })
})
</script>
