import { useState, useReducer } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/tauri'
import { dialog } from '@tauri-apps/api'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
  const filesReducer = (state: string[], action: { type: string; payload: string }) => {
    switch (action.type) {
      case 'add':
        if (state.includes(action.payload)) {
          return state
        }
        return [...state, action.payload]
      case 'remove':
        return state.filter((file) => file !== action.payload)
      case 'clear':
        return []
      default:
        return state
    }
  }

  const [files, dispatchFiles] = useReducer(filesReducer, [])
  const [isHovering, setIsHovering] = useState(false)
  const [progress, setProgress] = useState(0)

  listen('tauri://file-drop', (event) => {
    setIsHovering(false)
    const paths = event.payload as string[]
    paths.forEach((path) => {
      invoke('get_ncmfile_list', { path: path }).then((res) => {
        const files = res as Array<string>
        files.forEach((file) => {
          dispatchFiles({ type: 'add', payload: file })
        })
      })
    })
  })

  listen('tauri://file-drop-hover', (_event) => {
    setIsHovering(true)
  })

  listen('tauri://file-drop-cancelled', (_event) => {
    setIsHovering(false)
  })

  const handleClick = () => {
    dialog
      .open({
        multiple: true,
        filters: [{ name: 'NCM Files', extensions: ['ncm'] }],
      })
      .then((res) => {
        const paths = res as Array<string>
        paths.forEach((path: string) => {
          dispatchFiles({ type: 'add', payload: path })
        })
      })
  }

  const handleDump = async () => {
    const path = await dialog.open({
      directory: true,
    })
    if (path === null) {
      return
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (files.length > 1) {
        setProgress(((i + 1) * 100) / files.length)
      }
      try {
        await invoke('dump', { filePath: file, outputDir: path })
      } catch (e) {
        console.error(e)
      }
    }
    setProgress(0)
    dispatchFiles({ type: 'clear', payload: '' })
    dialog.message('All files have been dumped!', { title: 'Success' })
  }

  return (
    <motion.div className="w-full flex flex-col justify-start items-center h-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-2xl font-bold mb-5 mt-5">Ncmdump GUI</h1>
      <motion.div
        layout
        className={`w-3/4 md:w-2/3 lg:w-1/2 flex-auto mb-10 border-2 border-dashed rounded-lg flex justify-center items-center cursor-pointer ${
          files.length > 0 ? 'max-h-24' : ''
        }`}
        animate={{ borderColor: isHovering ? '#2563EB' : '#D1D5DB', scale: isHovering ? (files.length > 0 ? 1.05 : 1.02) : 1 }}
        transition={{ duration: 0.1 }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <motion.div layout="position" transition={{ duration: 0.1 }}>
          Drop files here or click to select
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {files.length > 0 && (
          <>
            <motion.div
              layout
              layoutScroll
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-3/4 md:w-2/3 lg:w-1/2 flex-auto mb-5 h-64 overflow-auto border border-gray-200 rounded-lg"
            >
              <AnimatePresence>
                {files.map((file, _index) => (
                  <motion.div
                    layout
                    key={file}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    className="flex justify-between items-center p-2 hover:bg-gray-100"
                  >
                    <p className="truncate">{file}</p>
                    <button
                      className="ml-4 bg-red-500 hover:bg-red-700 text-white font-bold px-2 rounded-sm"
                      onClick={() => dispatchFiles({ type: 'remove', payload: file })}
                    >
                      x
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            <button
              className="w-3/4 md:w-2/3 lg:w-1/2 mb-5 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => handleDump()}
            >
              Go! 🚀
            </button>
            {progress > 0 && (
              <div className="w-full bg-gray-200 rounded dark:bg-gray-700">
                <motion.div
                  className="bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded"
                  initial={{ width: '2.5rem', opacity: 0 }}
                  animate={{ width: `${progress}%`, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  {progress.toFixed(0)}%
                </motion.div>
              </div>
            )}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default App
