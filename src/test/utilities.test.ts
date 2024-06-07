import { _cleanNoteContent, _formatHashTag, _addFrontMatterTags, _getRemovalProcessor,
         _removeAllFrontMatterTags, _removeFrontMatterTag, _conformToArray,
         _apply_bulk_changes } from "utilities"


// region Mock imports
import { TFile } from "./mocks/obsidian"
import { _cleanFile } from "./mocks/quick_tagger_mocks"





// region tests

test('removes leading newlines and trailing spaces from yaml header', () => {
    expect(_cleanNoteContent(`


---
tags: test
---     
This is a note.
    `)).toMatch(`---
tags: test
---
This is a note.
    `)
})

test('given string, return array', () => {
    expect(_conformToArray("a, b, c")).toBeInstanceOf(Array)
})

test('conforms comma-seperated strings to tag list', () => {
    expect(_conformToArray("a, b, c")).toEqual(['a', 'b', 'c'])
})

test('conforms space-seperated strings to tag list', () => {
    expect(_conformToArray("a b c")).toEqual(['a', 'b', 'c'])
})

test('splits spaces in tags into separate tags', () => {
    expect(_conformToArray(["a", "b c"])).toEqual(['a', 'b', 'c'])
})


// Test _formatHashTag
test('remove hashtag character from tag', () => {
    expect(_formatHashTag('#test')).toBe('test')
})

test("don't botch non-hashtag tags", () => {
    expect(_formatHashTag('test')).toBe('test')
})



let mock_yaml = {"tags": ['#no'], "aliases": 'yes'} // hashtags should be removed
let fixed_mock_yaml = {"tags": ['no', 'hello'], 'aliases': 'yes'}

class TestFrontmatterTag{
    tag: string
    func: Function
    constructor(tag:string, func: Function) {
        this.tag = tag
        this.func = func
    }
    run() {
        return this.func.bind(this)
    }
}

// Test _addFrontMatterTag
test('test after adding a tag', () => {
    let execution = new TestFrontmatterTag('hello', _addFrontMatterTags);
    execution.run()(mock_yaml);
    expect(mock_yaml).toStrictEqual(fixed_mock_yaml);
})


// test getting the correct removal processor
test('get remove single tag processor', () => {
    expect(_getRemovalProcessor(['something'])).toBe(_removeFrontMatterTag)
})

test('get remove all tag processor', () => {
    expect(_getRemovalProcessor(['REMOVE ALL'])).toBe(_removeAllFrontMatterTags)
})


// test removal processors
let removal_fixed_mock_yaml = {"tags": ['hello'], 'aliases': 'yes'}
let removal_all_fixed_mock_yaml = {'tags': [], 'aliases': 'yes'}

test('remove one tag', () => {
    let execution = new TestFrontmatterTag('no', _removeFrontMatterTag);
    execution.run()(mock_yaml);
    expect(mock_yaml).toStrictEqual(removal_fixed_mock_yaml)
})

test('remove all tags', () => {
    mock_yaml = {"tags": ['no', 'hello', 'goodbye'], 'aliases': 'yes'}
    let execution = new TestFrontmatterTag('sianara', _removeAllFrontMatterTags);
    execution.run()(mock_yaml);
    expect(mock_yaml).toStrictEqual(removal_all_fixed_mock_yaml)
})


// region Bulk Processing tests
let mock_goodfile1 = new TFile()
let mock_goodfile2 = new TFile()
let mock_badfile = new TFile()

let mock_files = [mock_goodfile1, mock_goodfile1, mock_goodfile2]

test('bulk apply should log and continue if it encounters bad yaml', () => {
    let results = _apply_bulk_changes(mock_files, ["testTag"], (file, tag) => )
})