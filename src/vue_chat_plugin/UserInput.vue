<template>
  <div>
    <Suggestions :suggestions="suggestions" :colors="colors" @sendSuggestion="_submitSuggestion" />
    <div
      v-if="file"
      class="file-container"
      :style="{
        backgroundColor: colors.userInput.text,
        color: colors.userInput.bg
      }"
    >
      <span class="icon-file-message"
        ><img :src="icons.file.img" :alt="icons.file.name" height="15"
      /></span>
      {{ file.name }}
      <span class="delete-file-message" @click="cancelFile()"
        ><img
          :src="icons.closeSvg.img"
          :alt="icons.closeSvg.name"
          height="10"
          title="Remove the file"
      /></span>
    </div>
    <form
      class="sc-user-input"
      :class="{active: inputActive}"
      :style="{background: colors.userInput.bg}"
    >
      <div
        ref="userInput"
        role="button"
        tabIndex="0"
        contentEditable="true"
        :placeholder="placeholder"
        class="sc-user-input--text"
        :style="{color: colors.userInput.text}"
        @focus="setInputActive(true)"
        @blur="setInputActive(false)"
        @keydown="handleKey"
        @focusUserInput="focusUserInput()"
      ></div>
      <div class="sc-user-input--buttons">
        <div class="sc-user-input--button"></div>
        <div v-if="showEmoji && !isEditing" class="sc-user-input--button">
          <EmojiIcon :on-emoji-picked="_handleEmojiPicked" :color="colors.userInput.text" />
        </div>
        <div v-if="showFile && !isEditing" class="sc-user-input--button">
          <FileIcons :on-change="_handleFileSubmit" :color="colors.userInput.text" />
        </div>
        <div v-if="isEditing" class="sc-user-input--button">
          <UserInputButton
            :color="colors.userInput.text"
            tooltip="cancel"
            @click.native.prevent="_editFinish"
          >
            <IconCross />
          </UserInputButton>
        </div>
        <div class="sc-user-input--button">
          <UserInputButton
            v-if="isEditing"
            :color="colors.userInput.text"
            tooltip="Edit"
            @click.native.prevent="_editText"
          >
            <IconOk />
          </UserInputButton>
          <UserInputButton
            v-else
            :color="colors.userInput.text"
            tooltip="Send"
            @click.native.prevent="_submitText"
          >
            <IconSend />
          </UserInputButton>
        </div>
      </div>
    </form>
  </div>
</template>

<script>
import EmojiIcon from './icons/EmojiIcon.vue'
import FileIcons from './icons/FileIcons.vue'
import UserInputButton from './UserInputButton.vue'
import Suggestions from './Suggestions.vue'
import FileIcon from './assets/file.svg'
import CloseIconSvg from './assets/close.svg'
import store from './store/'
import IconCross from './components/icons/IconCross.vue'
import IconOk from './components/icons/IconOk.vue'
import IconSend from './components/icons/IconSend.vue'

export default {
  components: {
    EmojiIcon,
    FileIcons,
    UserInputButton,
    Suggestions,
    IconCross,
    IconOk,
    IconSend
  },
  props: {
    icons: {
      type: Object,
      default: function () {
        return {
          file: {
            img: FileIcon,
            name: 'default'
          },
          closeSvg: {
            img: CloseIconSvg,
            name: 'default'
          }
        }
      }
    },
    showEmoji: {
      type: Boolean,
      default: () => false
    },
    suggestions: {
      type: Array,
      default: () => []
    },
    showFile: {
      type: Boolean,
      default: () => false
    },
    onSubmit: {
      type: Function,
      required: true
    },
    placeholder: {
      type: String,
      default: 'Write something...'
    },
    colors: {
      type: Object,
      required: true
    },
    mmc_uid: {
      type: String,
      default: "information"
    }
  },
  data() {
    return {
      file: null,
      inputActive: false,
      store
    }
  },
  computed: {
    editMessageId() {
      return this.isEditing && store.editMessage.id
    },
    isEditing() {
      return store.editMessage && store.editMessage.id
    },
    currentUserId(){
      if(!this.store.currentUser){
        return this.mmc_uid;
      }
      return this.store.currentUser.id;
    }
  },
  watch: {
    editMessageId() {
      if (store.editMessage != null && store.editMessage != undefined) {
        this.$refs.userInput.focus()
        this.$refs.userInput.textContent = store.editMessage.data.text
      } else {
        this.$refs.userInput.textContent = ''
      }
    }
  },
  mounted() {
    this.$root.$on('focusUserInput', () => {
      if (this.$refs.userInput) {
        this.focusUserInput()
      }
    })
  },
  methods: {
    cancelFile() {
      this.file = null
    },
    setInputActive(onoff) {
      this.inputActive = onoff
    },
    handleKey(event) {
      if (event.keyCode === 13 && !event.shiftKey) {
        if (!this.isEditing) {
          this._submitText(event)
        } else {
          this._editText(event)
        }
        this._editFinish()
        event.preventDefault()
      } else if (event.keyCode === 27) {
        this._editFinish()
        event.preventDefault()
      }

      this.$emit('onType')
    },
    focusUserInput() {
      this.$nextTick(() => {
        this.$refs.userInput.focus()
      })
    },
    _submitSuggestion(suggestion) {
      this.onSubmit({author: this.currentUserId, type: 'text', data: {text: suggestion}})
    },
    _checkSubmitSuccess(success) {
      if (Promise !== undefined) {
        Promise.resolve(success).then(
          function (wasSuccessful) {
            if (wasSuccessful === undefined || wasSuccessful) {
              this.file = null
              this.$refs.userInput.innerHTML = ''
            }
          }.bind(this)
        )
      } else {
        this.file = null
        this.$refs.userInput.innerHTML = ''
      }
    },
    _submitText(event) {
      const text = this.$refs.userInput.textContent
      const file = this.file
      if (file) {
        this._submitTextWhenFile(event, text, file)
      } else {
        if (text && text.length > 0) {
          this._checkSubmitSuccess(
            this.onSubmit({
              author: this.currentUserId,
              type: 'text',
              data: {text}
            })
          )
        }
      }
    },
    _submitTextWhenFile(event, text, file) {
      if (text && text.length > 0) {
        this._checkSubmitSuccess(
          this.onSubmit({
            author: this.currentUserId,
            type: 'file',
            data: {text, file}
          })
        )
      } else {
        this._checkSubmitSuccess(
          this.onSubmit({
            author: this.currentUserId,
            type: 'file',
            data: {file}
          })
        )
      }
    },
    _editText() {
      const text = this.$refs.userInput.textContent
      if (text && text.length) {
        this.$emit('edit', {
          author: this.currentUserId,
          type: 'text',
          id: store.editMessage.id,
          data: {text}
        })
        this._editFinish()
      }
    },
    _handleEmojiPicked(emoji) {
      this._checkSubmitSuccess(
        this.onSubmit({
          author: this.currentUserId,
          type: 'emoji',
          data: {emoji}
        })
      )
    },
    _handleFileSubmit(file) {
      this.file = file
    },
    _editFinish() {
      this.store.editMessage = null
    }
  }
}
</script>

<style>
.sc-user-input {
  min-height: 55px;
  margin: 0px;
  position: relative;
  bottom: 0;
  display: flex;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.sc-user-input--text {
  width: 98%;
  outline: none;
  text-align: left;
  border-bottom-left-radius: 10px;
  box-sizing: border-box;
  padding: 18px;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.33;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #565867;
  -webkit-font-smoothing: antialiased;
  max-height: 200px;
  overflow: scroll;
  bottom: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.sc-user-input--text:empty:before {
  content: attr(placeholder);
  display: block; /* For Firefox */
  /* color: rgba(86, 88, 103, 0.3); */
  filter: contrast(15%);
  outline: none;
  cursor: text;
}

.sc-user-input--buttons {
  width: 100px;
  position: absolute;
  right: 30px;
  height: 100%;
  display: flex;
  justify-content: flex-end;
}

.sc-user-input--button:first-of-type {
  width: 40px;
}

.sc-user-input--button {
  width: 30px;
  height: 55px;
  margin-left: 2px;
  margin-right: 2px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sc-user-input.active {
  box-shadow: none;
  background-color: white;
  box-shadow: 0px -5px 20px 0px rgba(150, 165, 190, 0.2);
}

.sc-user-input--button label {
  position: relative;
  height: 24px;
  padding-left: 3px;
  cursor: pointer;
}

.sc-user-input--button label:hover path {
  fill: rgba(86, 88, 103, 1);
}

.sc-user-input--button input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  z-index: 99999;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  overflow: hidden;
}

.file-container {
  background-color: #f4f7f9;
  border-top-left-radius: 10px;
  padding: 5px 20px;
  color: #565867;
}

.delete-file-message {
  font-style: normal;
  float: right;
  cursor: pointer;
  color: #c8cad0;
}

.delete-file-message:hover {
  color: #5d5e6d;
}

.icon-file-message {
  margin-right: 5px;
}
</style>
