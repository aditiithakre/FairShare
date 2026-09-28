import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc,
  getDoc, getDocs, query, setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "./firebase";

/* Firestore has no joins, so a group carries two lists:
     members    the names costs are split between (not accounts)
     memberUids the accounts allowed to open the group
   The security rules are written against memberUids. */

const GROUPS = () => collection(db, "groups");
const EXPENSES = () => collection(db, "expenses");
const CODES = () => collection(db, "joinCodes");

/** Six characters, no vowels, so a code can't spell anything and 0/O and 1/I
 *  don't have to be told apart when read aloud. */
function makeJoinCode() {
  const alphabet = "BCDFGHJKLMNPQRSTVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const toGroup = (snap) => {
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    color: data.color,
    joinCode: data.joinCode,
    ownerId: data.ownerId,
    members: [...(data.members || [])].sort((a, b) => a.localeCompare(b)),
    memberUids: data.memberUids || [],
    createdAt: data.createdAt || "",
  };
};

const toExpense = (snap) => {
  const data = snap.data();
  return {
    id: snap.id,
    groupId: data.groupId,
    description: data.description,
    amountPaise: data.amountPaise,
    paidBy: data.paidBy,
    category: data.category,
    date: data.date,
    split: { mode: data.splitMode, people: data.splitPeople },
    createdAt: data.createdAt || "",
  };
};

export async function loadGroups(uid) {
  const snap = await getDocs(query(GROUPS(), where("memberUids", "array-contains", uid)));
  // reading a group needs no get() in the rules - membership is on the document itself
  return snap.docs.map(toGroup).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* One group at a time, deliberately. Reading an expense makes the rules fetch
   its group to check membership, and Firestore allows only 10 such fetches per
   QUERY, not per document. Asking for one group's expenses touches exactly one
   group document however many expenses come back; asking across every group at
   once would fail as soon as someone had more than ten of them. */
export async function loadExpenses(groupId) {
  const snap = await getDocs(query(EXPENSES(), where("groupId", "==", groupId)));
  return snap.docs
    .map(toExpense)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export async function createGroup({ name, color, members }, uid) {
  const joinCode = makeJoinCode();
  const group = await addDoc(GROUPS(), {
    name,
    color,
    joinCode,
    ownerId: uid,
    members,
    memberUids: [uid],
    createdAt: new Date().toISOString(),
  });

  // the code is its own document so someone who cannot yet read the group can still find it
  await setDoc(doc(CODES(), joinCode), { groupId: group.id });
  return group.id;
}

export async function joinGroup(code, uid) {
  const clean = code.trim().toUpperCase();
  const found = await getDoc(doc(CODES(), clean));
  if (!found.exists()) throw new Error("No group has that code");

  const groupId = found.data().groupId;
  // adding only your own uid is all the rules permit here
  await updateDoc(doc(GROUPS(), groupId), { memberUids: arrayUnion(uid) });
  return groupId;
}

export async function leaveGroup(groupId, uid) {
  await updateDoc(doc(GROUPS(), groupId), { memberUids: arrayRemove(uid) });
}

export async function addMember(groupId, name) {
  await updateDoc(doc(GROUPS(), groupId), { members: arrayUnion(name) });
}

export async function addExpense(expense, uid) {
  await addDoc(EXPENSES(), {
    groupId: expense.groupId,
    description: expense.description,
    amountPaise: expense.amountPaise,
    paidBy: expense.paidBy,
    category: expense.category,
    date: expense.date,
    splitMode: expense.split.mode,
    splitPeople: expense.split.people,
    createdBy: uid,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteExpense(id) {
  await deleteDoc(doc(EXPENSES(), id));
}
