package api

import (
	"net/http"
	"strings"
)

var (
	allowedContentTypes = []string{"image/png", "image/jpeg"}
)

func isAllowedContentType(contentType string) bool {
	for _, value := range allowedContentTypes {
		if contentType == value {
			return true
		}
	}

	return false
}

func getPhotoDetail(r *http.Request, user *User) (*PhotoDetail, bool, error) {
	photoID, err := NewRouteParams(r).Int("id")
	if err != nil {
		return nil, false, nil
	}
	return photoMgr.GetDetail(photoID, user)
}

func getPhoto(r *http.Request) (*Photo, bool, error) {
	photoID, err := NewRouteParams(r).Int("id")
	if err != nil {
		return nil, false, nil
	}
	return photoMgr.Get(photoID)
}

func deletePhoto(w http.ResponseWriter, r *http.Request) {

	user, ok := getUserOr401(w, r)
	if !ok {
		return
	}

	photo, exists, err := getPhoto(r)
	if err != nil {
		serverError(w, err)
		return
	}

	if !exists {
		http.NotFound(w, r)
		return
	}
	if !photo.CanDelete(user) {
		http.Error(w, "You can't delete this photo", http.StatusForbidden)
		return
	}
	if err := photoMgr.Delete(photo); err != nil {
		serverError(w, err)
		return
	}

	sendMessage(&SocketMessage{user.Name, "", photo.ID, "photo_deleted"})
	w.WriteHeader(http.StatusOK)
}

func photoDetail(w http.ResponseWriter, r *http.Request) {

	user, err := getCurrentUser(r)
	if err != nil {
		serverError(w, err)
		return
	}

	photo, exists, err := getPhotoDetail(r, user)
	if err != nil {
		serverError(w, err)
		return
	}
	if !exists {
		http.NotFound(w, r)
		return
	}

	writeJSON(w, photo, http.StatusOK)
}

func getPhotoToEdit(w http.ResponseWriter, r *http.Request) (*Photo, bool) {
	user, ok := getUserOr401(w, r)
	if !ok {
		return nil, false
	}

	photo, exists, err := getPhoto(r)

	if err != nil {
		serverError(w, err)
		return nil, false
	}

	if !exists {
		http.NotFound(w, r)
		return nil, false
	}

	if !photo.CanEdit(user) {
		http.Error(w, "You can't edit this photo", http.StatusForbidden)
		return photo, false
	}
	return photo, true
}

func editPhotoTitle(w http.ResponseWriter, r *http.Request) {

	photo, ok := getPhotoToEdit(w, r)

	if !ok {
		return
	}

	s := &struct {
		Title string `json:"title"`
	}{}

	if err := parseJSON(r, s); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	photo.Title = s.Title

	validator := getPhotoValidator(photo)

	if result, err := validator.Validate(); err != nil || !result.OK {
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, result, http.StatusBadRequest)
		return
	}

	if err := photoMgr.Update(photo); err != nil {
		serverError(w, err)
		return
	}
	if user, err := getCurrentUser(r); err == nil {
		sendMessage(&SocketMessage{user.Name, "", photo.ID, "photo_updated"})
	}
	w.WriteHeader(http.StatusOK)
}

func editPhotoTags(w http.ResponseWriter, r *http.Request) {

	photo, ok := getPhotoToEdit(w, r)

	if !ok {
		return
	}

	s := &struct {
		Tags []string `json:"tags"`
	}{}

	if err := parseJSON(r, s); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	photo.Tags = s.Tags

	if err := photoMgr.UpdateTags(photo); err != nil {
		serverError(w, err)
		return
	}
	if user, err := getCurrentUser(r); err == nil {
		sendMessage(&SocketMessage{user.Name, "", photo.ID, "photo_updated"})
	}
	w.WriteHeader(http.StatusOK)
}

func upload(w http.ResponseWriter, r *http.Request) {

	user, ok := getUserOr401(w, r)
	if !ok {
		return
	}

	title := r.FormValue("title")
	taglist := r.FormValue("taglist")
	tags := strings.Split(taglist, " ")

	src, hdr, err := r.FormFile("photo")
	if err != nil {
		if err == http.ErrMissingFile || err == http.ErrNotMultipart {
			http.Error(w, "No image was posted", http.StatusBadRequest)
			return
		}
		serverError(w, err)
		return
	}
	contentType := hdr.Header["Content-Type"][0]

	if !isAllowedContentType(contentType) {
		http.Error(w, "No image was posted", http.StatusBadRequest)
		return
	}

	defer src.Close()

	filename, err := imageProcessor.Process(src, contentType)

	if err != nil {
		serverError(w, err)
		return
	}

	photo := &Photo{Title: title,
		OwnerID:  user.ID,
		Filename: filename,
		Tags:     tags,
	}

	validator := getPhotoValidator(photo)

	if result, err := validator.Validate(); err != nil || !result.OK {
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, result, http.StatusBadRequest)
		return
	}

	if err := photoMgr.Insert(photo); err != nil {
		serverError(w, err)
		return
	}

	sendMessage(&SocketMessage{user.Name, "", photo.ID, "photo_uploaded"})
	writeJSON(w, photo, http.StatusOK)
}

func searchPhotos(w http.ResponseWriter, r *http.Request) {
	photos, err := photoMgr.Search(getPage(r), r.FormValue("q"))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, photos, http.StatusOK)
}

func photosByOwnerID(w http.ResponseWriter, r *http.Request) {
	ownerID, err := NewRouteParams(r).Int("ownerID")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	photos, err := photoMgr.ByOwnerID(getPage(r), ownerID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, photos, http.StatusOK)
}

func getPhotos(w http.ResponseWriter, r *http.Request) {
	photos, err := photoMgr.All(getPage(r), r.FormValue("orderBy"))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, photos, http.StatusOK)
}

func getTags(w http.ResponseWriter, r *http.Request) {
	tags, err := photoMgr.GetTagCounts()
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, tags, http.StatusOK)
}

func voteDown(w http.ResponseWriter, r *http.Request) {
	vote(w, r, func(photo *Photo) { photo.DownVotes += 1 })
}

func voteUp(w http.ResponseWriter, r *http.Request) {
	vote(w, r, func(photo *Photo) { photo.UpVotes += 1 })
}

func vote(w http.ResponseWriter, r *http.Request, fn func(photo *Photo)) {
	var (
		photo *Photo
		err   error
	)
	user, ok := getUserOr401(w, r)
	if !ok {
		return
	}

	photo, exists, err := getPhoto(r)
	if err != nil {
		serverError(w, err)
		return
	}
	if !exists {
		http.NotFound(w, r)
		return
	}

	if !photo.CanVote(user) {
		http.Error(w, "You can't vote on this photo", http.StatusForbidden)
		return
	}

	fn(photo)

	if err = photoMgr.Update(photo); err != nil {
		serverError(w, err)
		return
	}

	user.RegisterVote(photo.ID)

	if err = userMgr.Update(user); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}
