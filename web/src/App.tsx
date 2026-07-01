import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import DocsHome from './pages/docs/DocsHome'
import Installation from './pages/docs/Installation'
import Quickstart from './pages/docs/Quickstart'
import Providers from './pages/docs/Providers'
import SlashCommands from './pages/docs/SlashCommands'
import CliReference from './pages/docs/CliReference'
import Configuration from './pages/docs/Configuration'
import Keybindings from './pages/docs/Keybindings'
import Skills from './pages/docs/Skills'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/docs/" element={<DocsHome />} />
        <Route path="/docs/installation/" element={<Installation />} />
        <Route path="/docs/quickstart/" element={<Quickstart />} />
        <Route path="/docs/providers/" element={<Providers />} />
        <Route path="/docs/slash-commands/" element={<SlashCommands />} />
        <Route path="/docs/cli-reference/" element={<CliReference />} />
        <Route path="/docs/configuration/" element={<Configuration />} />
        <Route path="/docs/keybindings/" element={<Keybindings />} />
        <Route path="/docs/skills/" element={<Skills />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
