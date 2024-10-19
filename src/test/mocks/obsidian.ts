export{ App, FuzzySuggestModal, Menu, Modal, Notice, Setting, TFile }

class Notice{

}

class App {
    metadataCache = {
        getTags() {
            return(['testing1', 'testing2', 'testing3'])
        }
    }

    commands = {

    }
}

class TFile {
    text = "sample_text"
    get_text() {
        return this.text
    }
}

class Menu {

}

class FuzzySuggestModal {

}

class Modal {

}

class Setting {

}