require 'active_model'

class RequesterMessage
  include ActiveModel::API

  attr_accessor :name, :email, :message

  validates_presence_of :name
  validates_presence_of :email
  validates_presence_of :message
end
