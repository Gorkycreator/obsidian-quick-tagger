import { _cleanNoteContent } from "utilities"


export async function _cleanFile(f:TFile){
    let text = f.get_text()
    let modified = _cleanNoteContent(text)
    f.set_text(modified)
}